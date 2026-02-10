interface Env {
  CINDER_API_KEY: string;
  JUP_API_KEY: string;
  CACHE: KVNamespace;
}

// Cache configuration
const CACHE_KEY = "sol-incinerator-data-v2-weekly";
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

interface CoinGeckoMarketChartRangeResponse {
  prices?: [number, number][];
}

interface CryptoCompareHistodayResponse {
  Response?: string;
  Data?: {
    Data?: Array<{
      time: number;
      close: number;
    }>;
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
const EASTERN_TIMEZONE = "America/New_York";
const ONE_DAY_SECONDS = 86400;
const ONE_DAY_MS = ONE_DAY_SECONDS * 1000;

// Price APIs - try multiple sources (Jupiter first, then fallbacks)
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_PRICE_URL = `https://api.jup.ag/price/v3?ids=${SOL_MINT}`;
const CRYPTOCOMPARE_URL = "https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD";
const CRYPTOCOMPARE_HISTORY_URL = "https://min-api.cryptocompare.com/data/v2/histoday?fsym=SOL&tsym=USD";
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";
const COINGECKO_RANGE_URL = "https://api.coingecko.com/api/v3/coins/solana/market_chart/range?vs_currency=usd";

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

async function fetchJsonOrThrow<T>(url: string, options: RequestInit, label: string): Promise<T> {
  const res = await fetchWithRetry(url, options);
  if (!res.ok) {
    throw new Error(`API errors: ${label}=${res.status}`);
  }
  return await res.json() as T;
}

// Fetch SOL price - try Jupiter first (requires API key), then fallbacks
async function getSolPrice(env: Env): Promise<number> {
  // Try Jupiter Price API v3 (most reliable for Solana)
  try {
    const headers: Record<string, string> = {};
    if (env.JUP_API_KEY) {
      headers["x-api-key"] = env.JUP_API_KEY;
    }
    const res = await fetch(JUPITER_PRICE_URL, { headers });
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

function parseNumericValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getPointDate(point: TimeSeriesPoint): Date | null {
  const raw = point.timestamp || point.date;
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDateInEasternTime(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: EASTERN_TIMEZONE }));
}

function getEasternDayKey(date: Date): string {
  const easternDate = getDateInEasternTime(date);
  const year = easternDate.getFullYear();
  const month = String(easternDate.getMonth() + 1).padStart(2, "0");
  const day = String(easternDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEasternWeekStartKey(date: Date): string {
  const easternDate = getDateInEasternTime(date);
  const normalized = new Date(easternDate.getFullYear(), easternDate.getMonth(), easternDate.getDate());
  const weekday = normalized.getDay();
  const daysSinceMonday = (weekday + 6) % 7;
  normalized.setDate(normalized.getDate() - daysSinceMonday);

  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPointEasternDayKey(point: TimeSeriesPoint): string | null {
  const pointDate = getPointDate(point);
  return pointDate ? getEasternDayKey(pointDate) : null;
}

function getPointEasternWeekKey(point: TimeSeriesPoint): string | null {
  const pointDate = getPointDate(point);
  return pointDate ? getEasternWeekStartKey(pointDate) : null;
}

function getDayKeyLabel(dayKey: string): string {
  const [, month, day] = dayKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function sortTimeSeries(points: TimeSeriesPoint[]): TimeSeriesPoint[] {
  return [...points].sort((a, b) => {
    const aTs = getPointDate(a)?.getTime() ?? 0;
    const bTs = getPointDate(b)?.getTime() ?? 0;
    return aTs - bTs;
  });
}

function formatChartLabel(date: Date): string {
  const easternDate = getDateInEasternTime(date);
  return `${easternDate.getMonth() + 1}/${easternDate.getDate()}`;
}

function aggregateUsdWithHistoricalPrices(
  points: TimeSeriesPoint[],
  historicalPriceByDay: Map<string, number>,
  fallbackPriceUsd: number,
): number {
  return points.reduce((sum, point) => {
    const pointValue = parseNumericValue(point.value);
    if (pointValue <= 0) return sum;

    const pointDate = getPointDate(point);
    const historicalPrice = pointDate
      ? getHistoricalPriceForDate(pointDate, historicalPriceByDay, fallbackPriceUsd)
      : fallbackPriceUsd;

    return sum + (pointValue * historicalPrice);
  }, 0);
}

function getHistoricalPriceForDate(date: Date, historicalPriceByDay: Map<string, number>, fallbackPriceUsd: number): number {
  const utcDayKey = toUtcDayKey(date);
  const exactPrice = historicalPriceByDay.get(utcDayKey);
  if (exactPrice && exactPrice > 0) {
    return exactPrice;
  }

  // Rare fallback if source is missing a day: walk backwards up to a week.
  for (let i = 1; i <= 7; i++) {
    const lookbackDate = new Date(date.getTime() - (i * ONE_DAY_MS));
    const lookbackPrice = historicalPriceByDay.get(toUtcDayKey(lookbackDate));
    if (lookbackPrice && lookbackPrice > 0) {
      return lookbackPrice;
    }
  }

  return fallbackPriceUsd;
}

function collectDateRange(points: TimeSeriesPoint[]): { minTs: number; maxTs: number } | null {
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = 0;

  for (const point of points) {
    const date = getPointDate(point);
    if (!date) continue;

    const timestamp = date.getTime();
    if (timestamp < minTs) minTs = timestamp;
    if (timestamp > maxTs) maxTs = timestamp;
  }

  if (!Number.isFinite(minTs) || maxTs <= 0) return null;
  return { minTs, maxTs };
}

async function getHistoricalSolPrices(minTsMs: number, maxTsMs: number): Promise<Map<string, number>> {
  const cryptocomparePrices = await getHistoricalSolPricesFromCryptoCompare(minTsMs, maxTsMs);
  if (cryptocomparePrices.size > 0) return cryptocomparePrices;

  const coinGeckoPrices = await getHistoricalSolPricesFromCoinGecko(minTsMs, maxTsMs);
  if (coinGeckoPrices.size > 0) return coinGeckoPrices;

  return new Map();
}

async function getHistoricalSolPricesFromCryptoCompare(minTsMs: number, maxTsMs: number): Promise<Map<string, number>> {
  const pricesByDay = new Map<string, number>();
  const minTsSec = Math.floor(minTsMs / 1000);
  let toTsSec = Math.ceil(maxTsMs / 1000);

  while (toTsSec >= minTsSec) {
    const secondsToCover = toTsSec - minTsSec;
    const daysToCover = Math.floor(secondsToCover / ONE_DAY_SECONDS) + 1;
    const limit = Math.min(2000, Math.max(1, daysToCover));
    const url = `${CRYPTOCOMPARE_HISTORY_URL}&limit=${limit}&toTs=${toTsSec}`;

    let response: Response;
    try {
      response = await fetchWithRetry(url, {}, 2, 10000);
    } catch {
      break;
    }

    if (!response.ok) break;

    const body = (await response.json()) as CryptoCompareHistodayResponse;
    const rows = body.Data?.Data ?? [];
    if (body.Response !== "Success" || rows.length === 0) break;

    let oldestTimeSec = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      if (!row.time || !Number.isFinite(row.close) || row.close <= 0) continue;
      oldestTimeSec = Math.min(oldestTimeSec, row.time);
      pricesByDay.set(toUtcDayKey(new Date(row.time * 1000)), row.close);
    }

    if (!Number.isFinite(oldestTimeSec) || oldestTimeSec <= minTsSec) break;
    toTsSec = oldestTimeSec - ONE_DAY_SECONDS;
  }

  return pricesByDay;
}

async function getHistoricalSolPricesFromCoinGecko(minTsMs: number, maxTsMs: number): Promise<Map<string, number>> {
  const pricesByDay = new Map<string, number>();
  const fromSec = Math.floor(minTsMs / 1000) - ONE_DAY_SECONDS;
  const toSec = Math.ceil(maxTsMs / 1000) + ONE_DAY_SECONDS;
  const url = `${COINGECKO_RANGE_URL}&from=${fromSec}&to=${toSec}`;

  let response: Response;
  try {
    response = await fetchWithRetry(url, {}, 2, 10000);
  } catch {
    return pricesByDay;
  }

  if (!response.ok) return pricesByDay;

  const body = (await response.json()) as CoinGeckoMarketChartRangeResponse;
  const rows = body.prices ?? [];
  for (const [timestampMs, priceUsd] of rows) {
    if (!Number.isFinite(timestampMs) || !Number.isFinite(priceUsd) || priceUsd <= 0) continue;
    pricesByDay.set(toUtcDayKey(new Date(timestampMs)), priceUsd);
  }

  return pricesByDay;
}

// Fetch fresh data from all APIs
async function fetchFreshData(env: Env): Promise<Record<string, unknown>> {
  const headers = {
    Authorization: env.CINDER_API_KEY,
  };

  // Fetch sequentially to stay safely under Cloudflare outbound connection limits.
  const totalSol = await fetchJsonOrThrow<TotalSolReclaimedResponse>(
    `${API_BASE}/stats/totalSolReclaimed`,
    { headers },
    "totalSol",
  );
  const weeklyFees = sortTimeSeries(await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/charts/weekly/fees`,
    { headers },
    "weeklyFees",
  ));
  const dailyFees = sortTimeSeries(await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/charts/daily/fees`,
    { headers },
    "dailyFees",
  ));
  const cumulativeTransactions = await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/cumulativeTransactions`,
    { headers },
    "transactions",
  );
  const cumulativeUsers = await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/charts/monthly/cumulative_users`,
    { headers },
    "users",
  );
  const weeklyReclaimed = sortTimeSeries(await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/charts/weekly/burns/reclaim/combined`,
    { headers },
    "weeklyReclaimed",
  ));
  const dailyReclaimed = sortTimeSeries(await fetchJsonOrThrow<TimeSeriesPoint[]>(
    `${API_BASE}/stats/charts/daily/burns/reclaim/combined`,
    { headers },
    "dailyReclaimed",
  ));

  const solPrice = await getSolPrice(env);

  const dateRange = collectDateRange([
    ...weeklyFees,
    ...dailyFees,
    ...weeklyReclaimed,
    ...dailyReclaimed,
  ]);
  const historicalPriceByDay = dateRange
    ? await getHistoricalSolPrices(dateRange.minTs, dateRange.maxTs)
    : new Map<string, number>();

  // Get latest values from time series
  const latestTransactions = cumulativeTransactions[cumulativeTransactions.length - 1];
  const latestUsers = cumulativeUsers[cumulativeUsers.length - 1];
  const prevTransactions = cumulativeTransactions[cumulativeTransactions.length - 2];
  const prevUsers = cumulativeUsers[cumulativeUsers.length - 2];

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

  const currentEasternDayKey = getEasternDayKey(new Date());
  const currentEasternWeekKey = getEasternWeekStartKey(new Date());

  // Use complete weekly history plus current-week daily rows to keep totals current.
  const historicalWeeklyFees = weeklyFees.filter(point => {
    const pointWeek = getPointEasternWeekKey(point);
    return pointWeek !== null && pointWeek < currentEasternWeekKey;
  });
  const currentWeekDailyFees = dailyFees.filter(point => {
    const pointWeek = getPointEasternWeekKey(point);
    const pointDay = getPointEasternDayKey(point);
    return pointWeek === currentEasternWeekKey && pointDay !== null && pointDay < currentEasternDayKey;
  });
  const feesForTotals = [...historicalWeeklyFees, ...currentWeekDailyFees];
  const totalFeesSol = feesForTotals.reduce((sum, point) => sum + parseNumericValue(point.value), 0);
  const currentWeekFeeSol = currentWeekDailyFees.reduce((sum, point) => sum + parseNumericValue(point.value), 0);
  const prevWeekFees = historicalWeeklyFees[historicalWeeklyFees.length - 1];
  const prevWeekFeeSol = parseNumericValue(prevWeekFees?.value);

  const historicalWeeklyReclaimed = weeklyReclaimed.filter(point => {
    const pointWeek = getPointEasternWeekKey(point);
    return pointWeek !== null && pointWeek < currentEasternWeekKey;
  });
  const currentWeekDailyReclaimed = dailyReclaimed.filter(point => {
    const pointWeek = getPointEasternWeekKey(point);
    const pointDay = getPointEasternDayKey(point);
    return pointWeek === currentEasternWeekKey && pointDay !== null && pointDay < currentEasternDayKey;
  });

  // USD conversions (historical price per period)
  const totalSolReclaimedUsdCalculated = aggregateUsdWithHistoricalPrices(
    [...historicalWeeklyReclaimed, ...currentWeekDailyReclaimed],
    historicalPriceByDay,
    solPrice,
  );
  const totalFeesUsdCalculated = aggregateUsdWithHistoricalPrices(feesForTotals, historicalPriceByDay, solPrice);
  const currentWeekFeeUsdCalculated = currentWeekDailyFees.length > 0
    ? aggregateUsdWithHistoricalPrices(currentWeekDailyFees, historicalPriceByDay, solPrice)
    : 0;
  const prevWeekFeeUsdCalculated = prevWeekFees
    ? aggregateUsdWithHistoricalPrices([prevWeekFees], historicalPriceByDay, solPrice)
    : 0;
  const totalSolReclaimedUsd = totalSolReclaimedUsdCalculated > 0
    ? totalSolReclaimedUsdCalculated
    : (totalSolReclaimed * solPrice);
  const totalFeesUsd = totalFeesUsdCalculated > 0
    ? totalFeesUsdCalculated
    : (totalFeesSol * solPrice);
  const currentWeekFeeUsd = currentWeekFeeUsdCalculated > 0
    ? currentWeekFeeUsdCalculated
    : (currentWeekFeeSol * solPrice);
  const prevWeekFeeUsd = prevWeekFeeUsdCalculated > 0
    ? prevWeekFeeUsdCalculated
    : (prevWeekFeeSol * solPrice);

  // Build chart data
  const weeklyChartSource = [...historicalWeeklyFees];
  const currentWeekFeeSolForChart = currentWeekDailyFees.reduce((sum, point) => sum + parseNumericValue(point.value), 0);
  if (currentWeekFeeSolForChart > 0) {
    const lastCurrentWeekPoint = currentWeekDailyFees[currentWeekDailyFees.length - 1];
    weeklyChartSource.push({
      timestamp: lastCurrentWeekPoint.timestamp || lastCurrentWeekPoint.date,
      value: currentWeekFeeSolForChart,
    });
  }

  const completeWeeks = weeklyChartSource.filter(point => parseNumericValue(point.value) > 1);
  const last12Weeks = completeWeeks.slice(-12);
  const weeklyProfitChartData = last12Weeks.map(point => {
    const date = getPointDate(point);
    if (!date) return ["?", 0];
    const weekKey = getPointEasternWeekKey(point);
    const label = weekKey ? getDayKeyLabel(weekKey) : formatChartLabel(date);
    const val = parseNumericValue(point.value);
    const pointPrice = getHistoricalPriceForDate(date, historicalPriceByDay, solPrice);
    const usdVal = val * pointPrice;
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
    weekly_fees_sol: formatSol(currentWeekFeeSol),
    weekly_fees_sol_raw: currentWeekFeeSol.toFixed(4),
    weekly_fees_usd: formatUsd(currentWeekFeeUsd),
    weekly_fees_usd_raw: currentWeekFeeUsd.toFixed(2),
    prev_week_fees_sol: formatSol(prevWeekFeeSol),
    prev_week_fees_usd: formatUsd(prevWeekFeeUsd),
    // Backward-compatible aliases.
    monthly_fees_sol: formatSol(currentWeekFeeSol),
    monthly_fees_sol_raw: currentWeekFeeSol.toFixed(4),
    monthly_fees_usd: formatUsd(currentWeekFeeUsd),
    monthly_fees_usd_raw: currentWeekFeeUsd.toFixed(2),
    prev_month_fees_sol: formatSol(prevWeekFeeSol),
    prev_month_fees_usd: formatUsd(prevWeekFeeUsd),
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
      weeklyFeesCount: weeklyFees.length,
      dailyFeesCount: dailyFees.length,
      weeklyReclaimedCount: weeklyReclaimed.length,
      dailyReclaimedCount: dailyReclaimed.length,
      historicalPriceDays: historicalPriceByDay.size,
      currentWeekKey: currentEasternWeekKey,
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
