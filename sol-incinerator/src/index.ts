interface Env {
  CINDER_API_KEY: string;
  JUP_API_KEY: string;
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

// Helper to fetch with retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || i === retries) return res;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const headers = {
        Authorization: env.CINDER_API_KEY,
      };

      // Fetch SOL price - try Jupiter first (requires API key), then fallbacks
      const getSolPrice = async (): Promise<number> => {
        // Try Jupiter Price API v3 (most reliable for Solana)
        try {
          const res = await fetch(JUPITER_PRICE_URL, {
            headers: { "x-api-key": env.JUP_API_KEY },
          });
          if (res.ok) {
            const data = await res.json() as JupiterPriceResponse;
            if (data[SOL_MINT]?.usdPrice) return data[SOL_MINT].usdPrice;
          }
        } catch (e) { /* try next */ }

        // Fallback to CryptoCompare
        try {
          const res = await fetch(CRYPTOCOMPARE_URL);
          if (res.ok) {
            const data = await res.json() as { USD?: number };
            if (data.USD) return data.USD;
          }
        } catch (e) { /* try next */ }

        // Fallback to CoinGecko
        try {
          const res = await fetch(COINGECKO_URL);
          if (res.ok) {
            const data = await res.json() as CoinGeckoResponse;
            if (data.solana?.usd) return data.solana.usd;
          }
        } catch (e) { /* return 0 */ }

        return 0;
      };

      const solPricePromise = getSolPrice();

      // Fetch Cinder data sequentially to avoid connection limits
      const totalSolRes = await fetchWithRetry(`${API_BASE}/stats/totalSolReclaimed`, { headers });
      const monthlyFeesRes = await fetchWithRetry(`${API_BASE}/stats/charts/monthly/fees`, { headers });
      const weeklyFeesRes = await fetchWithRetry(`${API_BASE}/stats/charts/weekly/fees`, { headers });
      const cumulativeTransactionsRes = await fetchWithRetry(`${API_BASE}/stats/cumulativeTransactions`, { headers });
      const cumulativeUsersRes = await fetchWithRetry(`${API_BASE}/stats/charts/monthly/cumulative_users`, { headers });

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

      // Get SOL price
      const solPrice = await solPricePromise;

      // Get latest values from time series
      const latestTransactions = cumulativeTransactions[cumulativeTransactions.length - 1];
      const latestUsers = cumulativeUsers[cumulativeUsers.length - 1];

      // Get previous month for comparison
      const prevTransactions = cumulativeTransactions[cumulativeTransactions.length - 2];
      const prevUsers = cumulativeUsers[cumulativeUsers.length - 2];

      // Calculate total fees (sum all monthly fees, values are in SOL)
      const totalFeesSol = monthlyFees.reduce((sum, point) => {
        const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
        return sum + (val || 0);
      }, 0);

      // Get current month and previous month fees (last entry may be previous month if current month just started)
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

      // Build chart data - weekly profit (shows fluctuation)
      // Filter out incomplete weeks (value of 0 or very low)
      const completeWeeks = weeklyFees.filter(point => {
        const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
        return (val || 0) > 1; // Filter out weeks with < 1 SOL (incomplete)
      });
      const last12Weeks = completeWeeks.slice(-12);
      const weeklyProfitChartData = last12Weeks.map(point => {
        const date = new Date(point.date || point.timestamp || "");
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        const val = typeof point.value === "string" ? parseFloat(point.value) : point.value;
        const usdVal = (val || 0) * solPrice;
        return [label, Math.round(usdVal)];
      });

      // Build merge variables
      const mergeVariables = {
        // SOL Price
        sol_price: solPrice.toFixed(2),
        sol_price_formatted: formatUsd(solPrice),

        // Main headline stats
        total_sol_reclaimed: formatSol(totalSolReclaimed),
        total_sol_reclaimed_raw: totalSolReclaimed.toFixed(2),
        total_sol_reclaimed_usd: formatUsd(totalSolReclaimedUsd),
        total_sol_reclaimed_usd_raw: totalSolReclaimedUsd.toFixed(2),

        total_users: formatNumber(totalUsers),
        total_users_raw: totalUsers,
        total_transactions: formatNumber(totalTransactions),
        total_transactions_raw: totalTransactions,

        // Revenue / Fees (Protocol profit)
        total_fees_sol: formatSol(totalFeesSol),
        total_fees_sol_raw: totalFeesSol.toFixed(4),
        total_fees_usd: formatUsd(totalFeesUsd),
        total_fees_usd_raw: totalFeesUsd.toFixed(2),

        // Monthly fees
        monthly_fees_sol: formatSol(currentMonthFeeSol),
        monthly_fees_sol_raw: currentMonthFeeSol.toFixed(4),
        monthly_fees_usd: formatUsd(currentMonthFeeUsd),
        monthly_fees_usd_raw: currentMonthFeeUsd.toFixed(2),

        prev_month_fees_sol: formatSol(prevMonthFeeSol),
        prev_month_fees_usd: formatUsd(prevMonthFeeUsd),

        // Monthly activity
        monthly_new_users: formatNumber(monthlyNewUsers),
        monthly_new_users_raw: monthlyNewUsers,
        monthly_new_transactions: formatNumber(monthlyNewTransactions),
        monthly_new_transactions_raw: monthlyNewTransactions,

        // Averages
        avg_sol_per_user: avgSolPerUser.toFixed(4),
        avg_sol_per_user_display: formatSol(avgSolPerUser),
        avg_sol_per_tx: avgSolPerTx.toFixed(6),

        // Timestamp
        updated_at: new Date().toISOString(),
        updated_display: formatDateTime(new Date()),

        // Chart data (JSON strings for Chartkick)
        weekly_profit_chart_data: JSON.stringify(weeklyProfitChartData),
      };

      if (url.pathname === "/api") {
        return jsonResponse({
          ...mergeVariables,
          raw: {
            totalSol,
            latestTransactions,
            latestUsers,
            totalFeesSol,
            solPrice,
            monthlyFeesCount: monthlyFees.length,
          },
        });
      }

      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Sol Incinerator error:", message);
      return errorResponse(message);
    }
  },
};

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
