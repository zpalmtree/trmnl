import { getWeekData, getTrimesterName, getDevelopmentFact, getFunFact } from "./pregnancy-data";

interface Env {
  DUE_DATE: string;
  OPENAI_API_KEY?: string;
  FACT_CACHE?: KVNamespace;
}

interface CachedFacts {
  week: number;
  extraFacts: string[];
  generatedAt: number;
}

/**
 * Get current date in Eastern time
 */
function getEasternDate(): Date {
  const now = new Date();
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return eastern;
}

/**
 * Calculate pregnancy week and day from due date.
 * Pregnancy is 40 weeks (280 days) from LMP.
 * Week 1 Day 1 is 280 days before due date.
 */
function calculatePregnancyProgress(dueDate: Date, currentDate: Date = new Date()): {
  week: number;
  day: number;
  daysRemaining: number;
  totalDays: number;
  daysElapsed: number;
  percentComplete: number;
} {
  const PREGNANCY_DAYS = 280; // 40 weeks

  // Calculate the start date (LMP - Last Menstrual Period)
  const startDate = new Date(dueDate);
  startDate.setDate(startDate.getDate() - PREGNANCY_DAYS);

  // Calculate days elapsed since start
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((currentDate.getTime() - startDate.getTime()) / msPerDay);

  // Calculate days remaining until due date
  const daysRemaining = Math.max(0, Math.floor((dueDate.getTime() - currentDate.getTime()) / msPerDay));

  // Calculate week and day (1-indexed: Day 1 through Day 7)
  const week = Math.floor(daysElapsed / 7);
  const day = (daysElapsed % 7) + 1;

  // Calculate percentage complete
  const percentComplete = Math.min(100, Math.max(0, Math.round((daysElapsed / PREGNANCY_DAYS) * 100)));

  return {
    week,
    day,
    daysRemaining,
    totalDays: PREGNANCY_DAYS,
    daysElapsed,
    percentComplete,
  };
}

/**
 * Generate additional pregnancy facts using OpenAI
 */
async function generateExtraFacts(
  apiKey: string,
  week: number,
  babySize: string,
  trimester: number
): Promise<string[]> {
  const prompt = `You are providing interesting, medically accurate pregnancy facts for week ${week} (${trimester === 1 ? "first" : trimester === 2 ? "second" : "third"} trimester). The baby is currently the size of a ${babySize}.

Generate 5 unique, interesting "Did You Know?" facts about pregnancy at week ${week}. Facts should be:
- Medically accurate and reassuring
- Interesting and surprising
- Mix of baby development, mom's body changes, and general pregnancy trivia
- VERY concise - one short sentence only, max 15 words each
- Appropriate for expecting parents

Return ONLY a JSON array of 5 strings, no other text:
["fact 1", "fact 2", "fact 3", "fact 4", "fact 5"]`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const facts = JSON.parse(jsonMatch[0]) as string[];
      console.log(`Generated ${facts.length} extra facts for week ${week}`);
      return facts;
    }
  } catch (error) {
    console.error("Error generating facts:", error);
  }

  return [];
}

/**
 * Get or generate extra facts with caching
 */
async function getExtraFacts(
  env: Env,
  week: number,
  babySize: string,
  trimester: number
): Promise<string[]> {
  const cacheKey = `facts_week_${week}`;

  // Try to get from cache first
  if (env.FACT_CACHE) {
    try {
      const cached = await env.FACT_CACHE.get(cacheKey, "json") as CachedFacts | null;
      if (cached && cached.week === week && cached.extraFacts.length > 0) {
        console.log(`Using cached facts for week ${week}`);
        return cached.extraFacts;
      }
    } catch (e) {
      console.log("KV cache read error:", e);
    }
  }

  // Generate new facts if we have an API key
  if (env.OPENAI_API_KEY) {
    const facts = await generateExtraFacts(env.OPENAI_API_KEY, week, babySize, trimester);

    // Cache the facts for future use
    if (facts.length > 0 && env.FACT_CACHE) {
      try {
        const cacheData: CachedFacts = {
          week,
          extraFacts: facts,
          generatedAt: Date.now(),
        };
        // Cache for 7 days (facts are week-specific so they can be reused)
        await env.FACT_CACHE.put(cacheKey, JSON.stringify(cacheData), {
          expirationTtl: 60 * 60 * 24 * 7,
        });
        console.log(`Cached ${facts.length} facts for week ${week}`);
      } catch (e) {
        console.log("KV cache write error:", e);
      }
    }

    return facts;
  }

  return [];
}

/**
 * Select a fact based on the day, combining static and AI-generated facts
 */
function selectDailyFact(
  staticFacts: string[],
  extraFacts: string[],
  dayOfYear: number
): string {
  const allFacts = [...staticFacts, ...extraFacts];
  const index = dayOfYear % allFacts.length;
  return allFacts[index];
}

/**
 * Get day of year for fact rotation
 */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    const dueDate = new Date(env.DUE_DATE);
    const currentDate = getEasternDate();
    const progress = calculatePregnancyProgress(dueDate, currentDate);
    const weekData = getWeekData(progress.week);
    const weeksRemaining = Math.floor(progress.daysRemaining / 7);
    const dayOfYear = getDayOfYear(currentDate);

    // Get static facts for today (rotates through the 3 static facts)
    const staticDevelopment = getDevelopmentFact(progress.week, progress.day);
    const staticFunFact = getFunFact(progress.week, progress.day);

    // JSON API endpoint for debugging/webhooks
    if (url.pathname === "/api") {
      // Get extra AI-generated facts
      const extraFacts = await getExtraFacts(
        env,
        progress.week,
        weekData.size,
        weekData.trimester
      );

      return new Response(
        JSON.stringify({
          ...progress,
          weekData: {
            ...weekData,
            currentDevelopment: staticDevelopment,
            currentFunFact: staticFunFact,
          },
          extraFacts,
          dueDate: env.DUE_DATE,
          hasOpenAI: !!env.OPENAI_API_KEY,
          hasCache: !!env.FACT_CACHE,
        }, null, 2),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // For main endpoint, get extra facts and select daily fact
    let funFact = staticFunFact;

    if (env.OPENAI_API_KEY) {
      const extraFacts = await getExtraFacts(
        env,
        progress.week,
        weekData.size,
        weekData.trimester
      );

      if (extraFacts.length > 0) {
        // Combine static and AI facts, select based on day of year for variety
        funFact = selectDailyFact(weekData.funFacts, extraFacts, dayOfYear);
      }
    }

    // Flatten data for TRMNL merge variables
    const mergeVariables = {
      week: progress.week,
      day: progress.day,
      days_remaining: progress.daysRemaining,
      weeks_remaining: weeksRemaining,
      percent_complete: progress.percentComplete,
      baby_size: weekData.size,
      size_emoji: weekData.sizeEmoji,
      baby_length: weekData.length,
      baby_weight: weekData.weight,
      development: staticDevelopment,
      fun_fact: funFact,
      trimester: getTrimesterName(weekData.trimester),
    };

    // For polling strategy, TRMNL expects variables in root node (no wrapper)
    return new Response(JSON.stringify(mergeVariables), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
