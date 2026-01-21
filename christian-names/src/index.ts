interface Env {
  OPENAI_API_KEY: string;
  NAME_CACHE: KVNamespace;
}

interface NameEntry {
  name: string;
  meaning: string;
}

interface NamesResponse {
  names: NameEntry[];
}

interface FlatNamesResponse {
  name1: string;
  meaning1: string;
  name2: string;
  meaning2: string;
  name3: string;
  meaning3: string;
  name4: string;
  meaning4: string;
}

interface CachedNames {
  names: NameEntry[];
  fetchedAt: number;
}

const CACHE_KEY = "names_cache";
const RECENT_NAMES_KEY = "recent_names";
const NAMES_PER_FETCH = 20; // Fetch 20 names at once
const LOW_CACHE_THRESHOLD = 8; // Trigger refresh when below this
const MAX_RECENT_NAMES = 50; // Track last 50 names to avoid

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      // Get recent names to avoid duplicates
      const recentNames = await getRecentNames(env);

      // Try to get 4 names from cache
      const { names, cacheRemaining } = await getFromCache(env, 4);

      // If cache is low, trigger background refresh
      if (cacheRemaining < LOW_CACHE_THRESHOLD) {
        console.log(`Cache low (${cacheRemaining} remaining), triggering background refresh`);
        ctx.waitUntil(refreshCache(env, recentNames));
      }

      let result: NamesResponse;

      if (names.length >= 4) {
        // Serve from cache (instant!)
        console.log(`Serving 4 names from cache (${cacheRemaining} remaining)`);
        result = { names: names.slice(0, 4) };
      } else {
        // Cache empty - must fetch synchronously (slow, but rare)
        console.log("Cache empty, fetching synchronously...");
        result = await generateNames(env.OPENAI_API_KEY, recentNames, 4);
      }

      // Save new names to recent list
      await saveRecentNames(env, result.names.map(n => n.name), recentNames);

      if (url.pathname === "/api") {
        const cacheInfo = await getCacheInfo(env);
        return jsonResponse({ ...result, recentNames, cacheInfo, raw: true });
      }

      // Flatten for TRMNL merge variables
      if (!result.names || result.names.length < 4) {
        console.error("Not enough names returned:", result.names);
        return errorResponse("Failed to generate names");
      }

      const flat: FlatNamesResponse = {
        name1: result.names[0].name,
        meaning1: result.names[0].meaning,
        name2: result.names[1].name,
        meaning2: result.names[1].meaning,
        name3: result.names[2].name,
        meaning3: result.names[2].meaning,
        name4: result.names[3].name,
        meaning4: result.names[3].meaning,
      };

      return jsonResponse(flat);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error:", error);
      return errorResponse(message);
    }
  },
};

async function getCacheInfo(env: Env): Promise<{ cached_count: number; fetched_at: string } | null> {
  try {
    const cached = await env.NAME_CACHE.get(CACHE_KEY, "json") as CachedNames | null;
    if (cached) {
      return {
        cached_count: cached.names.length,
        fetched_at: new Date(cached.fetchedAt).toISOString(),
      };
    }
  } catch (e) {
    console.log("Cache info error:", e);
  }
  return null;
}

async function getFromCache(env: Env, count: number): Promise<{ names: NameEntry[]; cacheRemaining: number }> {
  try {
    const cached = await env.NAME_CACHE.get(CACHE_KEY, "json") as CachedNames | null;

    if (cached && cached.names.length >= count) {
      // Pop names from the front of the cache
      const names = cached.names.splice(0, count);

      // Update cache with remaining names
      if (cached.names.length > 0) {
        await env.NAME_CACHE.put(CACHE_KEY, JSON.stringify(cached));
      } else {
        await env.NAME_CACHE.delete(CACHE_KEY);
      }

      return { names, cacheRemaining: cached.names.length };
    }

    return { names: [], cacheRemaining: cached?.names.length || 0 };
  } catch (e) {
    console.log("Cache read error:", e);
    return { names: [], cacheRemaining: 0 };
  }
}

async function refreshCache(env: Env, recentNames: string[]): Promise<void> {
  try {
    console.log(`Refreshing cache with ${NAMES_PER_FETCH} new names...`);
    const result = await generateNames(env.OPENAI_API_KEY, recentNames, NAMES_PER_FETCH);

    if (result.names.length === 0) {
      console.error("Failed to generate names for cache refresh");
      return;
    }

    // Get existing cache and append new names
    const cached = await env.NAME_CACHE.get(CACHE_KEY, "json") as CachedNames | null;
    const existingNames = cached?.names || [];

    const newCache: CachedNames = {
      names: [...existingNames, ...result.names],
      fetchedAt: Date.now(),
    };

    await env.NAME_CACHE.put(CACHE_KEY, JSON.stringify(newCache));
    console.log(`Cache refreshed: now has ${newCache.names.length} names`);

    // Also update recent names to avoid duplicates in future
    await saveRecentNames(env, result.names.map(n => n.name), recentNames);
  } catch (e) {
    console.error("Cache refresh error:", e);
  }
}

async function getRecentNames(env: Env): Promise<string[]> {
  try {
    const cached = await env.NAME_CACHE.get(RECENT_NAMES_KEY, "json") as string[] | null;
    return cached || [];
  } catch (e) {
    console.log("KV read error:", e);
    return [];
  }
}

async function saveRecentNames(env: Env, newNames: string[], existing: string[]): Promise<void> {
  try {
    // Add new names to the front, keep only MAX_RECENT_NAMES
    const updated = [...newNames, ...existing].slice(0, MAX_RECENT_NAMES);
    await env.NAME_CACHE.put(RECENT_NAMES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.log("KV write error:", e);
  }
}

async function generateNames(apiKey: string, recentNames: string[], count: number): Promise<NamesResponse> {
  // Add randomness to avoid repetitive results
  const styles = [
    "Focus on SHORT names (1 syllable preferred): Jake, Sam, Max, Cole, Seth, Ian, Jack, Luke, Mark, Paul, Pete, Tom, Joe, Nick, Pat, Drew, Troy, Wade, Dean, Jude, Finn, Leo, Lane, Reid, Beau, Clay, Trey, Grant, Blake, Chase, Brett, Shane, Cody, Kyle, Ryan",
    "Focus on CLASSIC names: Matthew, Michael, Christopher, Nicholas, Benjamin, Jonathan, Timothy, Stephen, Andrew, Peter, Thomas, David, Daniel, Joseph, Anthony, Vincent, Patrick, Dominic, Sebastian, Nathaniel, William, Robert, Richard, Edward, Charles, George, Henry, Philip, Lawrence, Francis",
    "Focus on TIMELESS names: James, John, Paul, Mark, Luke, Peter, Simon, Thomas, Philip, Andrew, Nathan, Aaron, Adam, Eric, Brian, Kevin, Sean, Scott, Craig, Keith, Alan, Carl, Dennis, Gary, Roger, Bruce, Glenn, Wayne, Dale, Neil",
    "Mix of SHORT and FULL names: Jake/Jacob, Sam/Samuel, Matt/Matthew, Mike/Michael, Nick/Nicholas, Ben/Benjamin, Dan/Daniel, Tom/Thomas, Joe/Joseph, Tim/Timothy, Steve/Stephen, Andy/Andrew, Pete/Peter, Chris/Christopher, Nate/Nathan, Zach/Zachary",
  ];
  const styleHint = styles[Math.floor(Math.random() * styles.length)];
  const seed = Math.floor(Math.random() * 10000);

  const avoidList = recentNames.length > 0
    ? `\nAVOID THESE RECENT NAMES: ${recentNames.join(", ")}`
    : "";

  const prompt = `Generate exactly ${count} random Christian boy names that would be good for a baby born today.

RANDOM SEED: ${seed} - Use this to vary your selections.
STYLE HINT: ${styleHint}${avoidList}

IMPORTANT RULES:
- Choose names that real parents actually use - nothing too unusual
- NO trendy misspellings (no Jaxon, Jaycen, Brayden, Kayden, Aiden variants)
- NO old-fashioned Biblical prophet/patriarch names (Ezekiel, Isaiah, Jeremiah, Obadiah, Elijah, Elisha, Micah, Amos, Hosea, Joel, Jonah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Malachi, Abraham, Moses, Gideon, Samson, etc.)
- NO Levi
- Names should have Christian/Biblical roots or meaning
- Keep meanings concise (under 10 words)
- Be RANDOM - pick different names each time

Respond with ONLY valid JSON:
{"names": [{"name": "Name1", "meaning": "meaning"}, ...]}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2-chat-latest",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`OpenAI API error: ${response.status} - ${errorBody}`);
    return getFallbackNames(recentNames, count);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
    error?: { message: string };
  };

  if (data.error) {
    console.error(`OpenAI error: ${data.error.message}`);
    return getFallbackNames(recentNames, count);
  }

  const content = data.choices?.[0]?.message?.content || "";

  if (!content) {
    console.error("Empty response from OpenAI");
    return getFallbackNames(recentNames, count);
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as NamesResponse;
      if (parsed.names && parsed.names.length >= count) {
        console.log(`Generated ${parsed.names.length} names from OpenAI`);
        return { names: parsed.names.slice(0, count) };
      }
    }
  } catch (e) {
    console.error("Failed to parse response:", content);
  }

  return getFallbackNames(recentNames, count);
}

function getFallbackNames(recentNames: string[], count: number): NamesResponse {
  const allNames: NameEntry[] = [
    // Classic Biblical
    { name: "Luke", meaning: "Light-giving; Gospel author" },
    { name: "Matthew", meaning: "Gift of God; apostle" },
    { name: "James", meaning: "Supplanter; apostle" },
    { name: "Michael", meaning: "Who is like God; archangel" },
    { name: "Gabriel", meaning: "God is my strength; angel" },
    { name: "David", meaning: "Beloved; king of Israel" },
    { name: "Daniel", meaning: "God is my judge; prophet" },
    { name: "Nathan", meaning: "He gave; prophet" },
    { name: "Caleb", meaning: "Faithful, devoted" },
    { name: "Benjamin", meaning: "Son of the right hand" },
    { name: "Samuel", meaning: "Heard by God; prophet" },
    { name: "Andrew", meaning: "Strong; first apostle called" },
    { name: "Simon", meaning: "He has heard; apostle Peter" },
    { name: "Timothy", meaning: "Honoring God" },
    { name: "Stephen", meaning: "Crown; first martyr" },
    { name: "Noah", meaning: "Rest, comfort" },
    { name: "Joshua", meaning: "The Lord is salvation" },
    { name: "Aaron", meaning: "High mountain; priest" },
    { name: "Adam", meaning: "Man; first human" },
    { name: "Joseph", meaning: "He will add" },
    { name: "Peter", meaning: "Rock; leader of apostles" },
    { name: "Paul", meaning: "Small, humble; apostle" },
    { name: "John", meaning: "God is gracious; apostle" },
    { name: "Mark", meaning: "Warlike; Gospel author" },
    { name: "Philip", meaning: "Lover of horses; apostle" },
    { name: "Thomas", meaning: "Twin; doubting apostle" },
    // Short/Nicknames
    { name: "Jake", meaning: "Supplanter; from Jacob" },
    { name: "Sam", meaning: "Heard by God; from Samuel" },
    { name: "Max", meaning: "Greatest" },
    { name: "Jack", meaning: "God is gracious" },
    { name: "Cole", meaning: "Victory of the people" },
    { name: "Matt", meaning: "Gift of God" },
    { name: "Ben", meaning: "Son of the right hand" },
    { name: "Dan", meaning: "God is my judge" },
    { name: "Nick", meaning: "Victory of the people" },
    { name: "Tom", meaning: "Twin" },
    { name: "Joe", meaning: "He will add" },
    { name: "Tim", meaning: "Honoring God" },
    { name: "Steve", meaning: "Crown" },
    { name: "Pete", meaning: "Rock" },
    { name: "Andy", meaning: "Strong, manly" },
    { name: "Chris", meaning: "Bearer of Christ" },
    { name: "Nate", meaning: "Gift from God" },
    { name: "Zach", meaning: "God remembers" },
    // Modern classics
    { name: "Ryan", meaning: "Little king" },
    { name: "Kyle", meaning: "Narrow strait" },
    { name: "Sean", meaning: "God is gracious" },
    { name: "Brian", meaning: "Noble, strong" },
    { name: "Kevin", meaning: "Handsome, beloved" },
    { name: "Eric", meaning: "Eternal ruler" },
    { name: "Scott", meaning: "From Scotland" },
    { name: "Chad", meaning: "Warrior" },
    { name: "Brett", meaning: "From Brittany" },
    { name: "Grant", meaning: "Great, large" },
    { name: "Blake", meaning: "Dark, fair" },
    { name: "Chase", meaning: "Hunter" },
    { name: "Drew", meaning: "Strong, manly" },
    { name: "Troy", meaning: "Foot soldier" },
    { name: "Shane", meaning: "God is gracious" },
    { name: "Dean", meaning: "Valley" },
    { name: "Wade", meaning: "River crossing" },
    { name: "Reid", meaning: "Red-haired" },
    { name: "Jude", meaning: "Praised" },
    { name: "Finn", meaning: "Fair" },
    { name: "Owen", meaning: "Young warrior" },
    { name: "Leo", meaning: "Lion" },
    { name: "Ian", meaning: "God is gracious" },
    { name: "Seth", meaning: "Appointed" },
    { name: "Evan", meaning: "God is gracious" },
    { name: "Ethan", meaning: "Strong, firm" },
  ];

  // Filter out recent names and shuffle
  const available = allNames.filter(n => !recentNames.includes(n.name));
  const shuffled = available.sort(() => Math.random() - 0.5);
  return { names: shuffled.slice(0, count) };
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
