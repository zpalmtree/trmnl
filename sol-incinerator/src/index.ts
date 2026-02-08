interface Env {
  CINDER_API_KEY: string;
  JUP_API_KEY: string;
  CACHE: KVNamespace;
}

// Cache configuration
const CACHE_KEY = "sol-incinerator-data";
const CACHE_TTL_SECONDS = 300; // 5 minutes - data is fresh
const CACHE_STALE_TTL_SECONDS = 3600; // 1 hour - serve stale if fetch fails

interface CachedData {
  data: Record<string, unknown>;
  timestamp: number;
}

interface TimeSeriesPoint {
  timestamp?: string;
  date?: string;
  value: string | number;
}

interface TotalSolReclaimedResponse {
  totalSolReclaimed: string;
}

interface CoinGeckoResponse {
  solana: {
    usd: number;
  };
}

interface JupiterPriceResponse {
  [mintAddress: string]: {
    decimals: number;
    usdPrice: number;
    blockId?: number | null;
    priceChange24h?: number | null;
  };
}

const API_BASE = "https://sol-incinerator.dev/api";

// Price APIs - try multiple sources (Jupiter first, then fallbacks)
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_PRICE_URL = `https://api.jup.ag/price/v3?ids=${SOL_MINT}`;
const CRYPTOCOMPARE_URL = "https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

// Helper to fetch with retry and timeout
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, timeoutMs = 8000): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || i === retries) return res;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

// Fetch SOL price - try Jupiter first (requires API key), then fallbacks
async function getSolPrice(env: Env): Promise<number> {
  // Try Jupiter Price API v3 (most reliable for Solana)
  try {
    const res = await fetch(JUPITER_PRICE_URL, {
      headers: { "x-api-key": env.JUP_API_KEY },
    });
    if (res.ok) {
      const data = await res.json() as JupiterPriceResponse;
      if (data[SOL_MINT]?.usdPrice) return data[SOL_MINT].usdPrice;
    }
  } catch { /* try next */ }

  // Fallback to CryptoCompare
  try {
    const res = await fetch(CRYPTOCOMPARE_URL);
    if (res.ok) {
      const data = await res.json() as { USD?: number };
      if (data.USD) return data.USD;
    }
  } catch { /* try next */ }

  // Fallback to CoinGecko
  try {
    const res = await fetch(COINGECKO_URL);
    if (res.ok) {
      const data = await res.json() as CoinGeckoResponse;
      if (data.solana?.usd) return data.solana.usd;
    }
  } catch { /* return 0 */ }

  return 0;
}

// Fetch fresh data from all APIs
async function fetchFreshData(env: Env): Promise<Record<string, unknown>> {
  const headers = {
    Authorization: env.CINDER_API_KEY,
  };

  const solPricePromise = getSolPrice(env);

  // Fetch Cinder data in parallel for faster response
  const [totalSolRes, monthlyFeesRes, weeklyFeesRes, cumulativeTransactionsRes, cumulativeUsersRes] = await Promise.all([
    fetchWithRetry(`${API_BASE}/stats/totalSolReclaimed`, { headers }),
    fetchWithRetry(`${API_BASE}/stats/charts/monthly/fees`, { headers }),
    fetchWithRetry(`${API_BASE}/stats/charts/weekly/fees`, { headers }),
    fetchWithRetry(`${API_BASE}/stats/cumulativeTransactions`, { headers }),
    fetchWithRetry(`${API_BASE}/stats/charts/monthly/cumulative_users`, { headers }),
  ]);

  // Check responses
  const errors: string[] = [];
  if (!totalSolRes.ok) errors.push(`totalSol=${totalSolRes.status}`);
  if (!cumulativeTransactionsRes.ok) errors.push(`transactions=${cumulativeTransactionsRes.status}`);
  if (!cumulativeUsersRes.ok) errors.push(`users=${cumulativeUsersRes.status}`);
  if (!monthlyFeesRes.ok) errors.push(`monthlyFees=${monthlyFeesRes.status}`);
  if (!weeklyFeesRes.ok) errors.push(`weeklyFees=${weeklyFeesRes.status}`);

  if (errors.length > 0) {
    throw new Error(`API errors: ${errors.join(", ")}`);
  }

  const totalSol = (await totalSolRes.json()) as TotalSolReclaimedResponse;
  const cumulativeTransactions = (await cumulativeTransactionsRes.json()) as TimeSeriesPoint[];
  const cumulativeUsers = (await cumulativeUsersRes.json()) as TimeSeriesPoint[];
  const monthlyFees = (await monthlyFeesRes.json()) as TimeSeriesPoint[];
  const weeklyFees = (await weeklyFeesRes.json()) as TimeSeriesPoint[];

  const solPrice = await solPricePromise;

  // Get latest values from time series
  const latestTransactions = cumulativeTransactions[cumulativeTransactions.length - 1];
  const latestUsers = cumulativeUsers[cumulativeUsers.length - 1];
  const prevTransactions = cumulativeTransactions[cumulativeTransactions.length - 2];
  const prevUsers = cumulativeUsers[cumulativeUsers.length - 2];

  // Calculate total fees
  const totalFeesSol = monthlyFees.reduce((sum, point) => {
    const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
    return sum + (val || 0);
  }, 0);

  const currentMonthFees = monthlyFees[monthlyFees.length - 1];
  const prevMonthFees = monthlyFees[monthlyFees.length - 2];
  const currentMonthFeeSol = typeof currentMonthFees?.value === "string"
    ? parseFloat(currentMonthFees.value)
    : (currentMonthFees?.value || 0);
  const prevMonthFeeSol = typeof prevMonthFees?.value === "string"
    ? parseFloat(prevMonthFees.value)
    : (prevMonthFees?.value || 0);

  // Calculate totals
  const totalSolReclaimed = parseFloat(totalSol.totalSolReclaimed);
  const totalTransactions = parseInt(String(latestTransactions?.value || "0"), 10);
  const totalUsers = parseInt(String(latestUsers?.value || "0"), 10);

  // Calculate monthly growth
  const prevMonthTransactions = parseInt(String(prevTransactions?.value || "0"), 10);
  const prevMonthUsers = parseInt(String(prevUsers?.value || "0"), 10);
  const monthlyNewTransactions = totalTransactions - prevMonthTransactions;
  const monthlyNewUsers = totalUsers - prevMonthUsers;

  // Format functions
  const formatSol = (sol: number): string => {
    if (sol >= 1000000) return `${(sol / 1000000).toFixed(2)}M`;
    if (sol >= 1000) return `${(sol / 1000).toFixed(2)}K`;
    if (sol >= 1) return sol.toFixed(2);
    return sol.toFixed(4);
  };

  const formatUsd = (usd: number): string => {
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(2)}K`;
    return `$${usd.toFixed(2)}`;
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Calculate averages
  const avgSolPerUser = totalUsers > 0 ? totalSolReclaimed / totalUsers : 0;
  const avgSolPerTx = totalTransactions > 0 ? totalSolReclaimed / totalTransactions : 0;

  // USD conversions
  const totalSolReclaimedUsd = totalSolReclaimed * solPrice;
  const totalFeesUsd = totalFeesSol * solPrice;
  const currentMonthFeeUsd = currentMonthFeeSol * solPrice;
  const prevMonthFeeUsd = prevMonthFeeSol * solPrice;

  // Build chart data
  const completeWeeks = weeklyFees.filter(point => {
    const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
    return (val || 0) > 1;
  });
  const last12Weeks = completeWeeks.slice(-12);
  const weeklyProfitChartData = last12Weeks.map(point => {
    const date = new Date(point.date || point.timestamp || "");
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
    const usdVal = (val || 0) * solPrice;
    return [label, Math.round(usdVal)];
  });

  return {
    sol_price: solPrice.toFixed(2),
    sol_price_formatted: formatUsd(solPrice),
    total_sol_reclaimed: formatSol(totalSolReclaimed),
    total_sol_reclaimed_raw: totalSolReclaimed.toFixed(2),
    total_sol_reclaimed_usd: formatUsd(totalSolReclaimedUsd),
    total_sol_reclaimed_usd_raw: totalSolReclaimedUsd.toFixed(2),
    total_users: formatNumber(totalUsers),
    total_users_raw: totalUsers,
    total_transactions: formatNumber(totalTransactions),
    total_transactions_raw: totalTransactions,
    total_fees_sol: formatSol(totalFeesSol),
    total_fees_sol_raw: totalFeesSol.toFixed(4),
    total_fees_usd: formatUsd(totalFeesUsd),
    total_fees_usd_raw: totalFeesUsd.toFixed(2),
    monthly_fees_sol: formatSol(currentMonthFeeSol),
    monthly_fees_sol_raw: currentMonthFeeSol.toFixed(4),
    monthly_fees_usd: formatUsd(currentMonthFeeUsd),
    monthly_fees_usd_raw: currentMonthFeeUsd.toFixed(2),
    prev_month_fees_sol: formatSol(prevMonthFeeSol),
    prev_month_fees_usd: formatUsd(prevMonthFeeUsd),
    monthly_new_users: formatNumber(monthlyNewUsers),
    monthly_new_users_raw: monthlyNewUsers,
    monthly_new_transactions: formatNumber(monthlyNewTransactions),
    monthly_new_transactions_raw: monthlyNewTransactions,
    avg_sol_per_user: avgSolPerUser.toFixed(4),
    avg_sol_per_user_display: formatSol(avgSolPerUser),
    avg_sol_per_tx: avgSolPerTx.toFixed(6),
    updated_at: new Date().toISOString(),
    updated_display: formatDateTime(new Date()),
    weekly_profit_chart_data: JSON.stringify(weeklyProfitChartData),
    // Include raw data for /api endpoint
    _raw: {
      totalSol,
      latestTransactions,
      latestUsers,
      totalFeesSol,
      solPrice,
      monthlyFeesCount: monthlyFees.length,
    },
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      // Check cache first
      const cached = await env.CACHE.get(CACHE_KEY, "json") as CachedData | null;
      const now = Date.now();
      const cacheAge = cached ? (now - cached.timestamp) / 1000 : Infinity;
      const isFresh = cacheAge < CACHE_TTL_SECONDS;
      const isStale = cacheAge < CACHE_STALE_TTL_SECONDS;

      // If cache is fresh, return it immediately
      if (cached && isFresh) {
        return respondWithData(url.pathname, cached.data);
      }

      // If cache exists but is stale, return it and refresh in background
      if (cached && isStale) {
        // Trigger background refresh
        ctx.waitUntil(refreshCache(env));
        return respondWithData(url.pathname, cached.data);
      }

      // No usable cache - fetch fresh data (blocking)
      const freshData = await fetchFreshData(env);

      // Cache the fresh data
      await env.CACHE.put(CACHE_KEY, JSON.stringify({
        data: freshData,
        timestamp: now,
      } as CachedData));

      return respondWithData(url.pathname, freshData);
    } catch (error) {
      // If fetch failed but we have stale cache, use it
      try {
        const staleCache = await env.CACHE.get(CACHE_KEY, "json") as CachedData | null;
        if (staleCache) {
          console.error("Using stale cache due to error:", error instanceof Error ? error.message : "Unknown error");
          return respondWithData(url.pathname, staleCache.data);
        }
      } catch { /* ignore cache read error */ }

      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Sol Incinerator error:", message);
      return errorResponse(message);
    }
  },
};

// Background refresh function
async function refreshCache(env: Env): Promise<void> {
  try {
    const freshData = await fetchFreshData(env);
    await env.CACHE.put(CACHE_KEY, JSON.stringify({
      data: freshData,
      timestamp: Date.now(),
    } as CachedData));
  } catch (error) {
    console.error("Background refresh failed:", error instanceof Error ? error.message : "Unknown error");
  }
}

// Helper to respond with data (handles /api vs default routes)
function respondWithData(pathname: string, data: Record<string, unknown>): Response {
  if (pathname === "/api") {
    const { _raw, ...mergeVariables } = data;
    return jsonResponse({
      ...mergeVariables,
      raw: _raw,
    });
  }

  // Remove internal _raw field for default response
  const { _raw, ...mergeVariables } = data;
  return jsonResponse(mergeVariables);
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function jsonResponse(data: object): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
