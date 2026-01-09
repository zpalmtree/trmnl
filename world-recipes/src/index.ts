interface Env {
  SPOONACULAR_API_KEY: string;
  OPENAI_API_KEY: string;
  CUISINES: string;
  RECIPE_CACHE: KVNamespace;
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  readyInMinutes: number;
  preparationMinutes?: number;
  cookingMinutes?: number;
  servings: number;
  sourceUrl: string;
  image: string;
  cuisines: string[];
  dishTypes: string[];
  extendedIngredients: {
    original: string;
    name: string;
    amount: number;
    unit: string;
  }[];
  instructions: string;
  summary: string;
}

interface SpoonacularResponse {
  recipes: SpoonacularRecipe[];
}

interface RecipeOutput {
  title: string;
  cuisine: string;
  cook_time: string;
  ingredients: string;
  instructions: string;
  image_url: string;
}

const CACHE_KEY = "recipe_cache";
const RECIPES_PER_FETCH = 10; // Fetch 10 recipes at once to save API quota

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      // Pick a random cuisine from the configured list
      const cuisines = env.CUISINES.split(",");
      const randomCuisine = cuisines[Math.floor(Math.random() * cuisines.length)].trim();

      // Try to get a cached recipe first, otherwise fetch new batch
      const recipe = await getOrFetchRecipe(env, randomCuisine);

      if (!recipe) {
        return errorResponse("Failed to fetch recipe");
      }

      // Use GPT to condense and format the recipe
      const formatted = await formatWithGPT(env.OPENAI_API_KEY, recipe, randomCuisine);

      // Construct largest resolution image URL (636x393)
      // Format: https://img.spoonacular.com/recipes/{ID}-{SIZE}.{TYPE}
      const largeImageUrl = recipe.id
        ? `https://img.spoonacular.com/recipes/${recipe.id}-636x393.jpg`
        : recipe.image || "";

      // Return merge variables for TRMNL
      const response: RecipeOutput = {
        title: formatted.title || recipe.title,
        cuisine: formatted.cuisine || randomCuisine,
        cook_time: formatted.cook_time || "Time unknown",
        ingredients: formatted.ingredients,
        instructions: formatted.instructions,
        image_url: largeImageUrl,
      };

      // Debug endpoint
      if (url.pathname === "/api") {
        return jsonResponse({
          ...response,
          raw_recipe: recipe,
          cache_info: await getCacheInfo(env),
        });
      }

      return jsonResponse(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Main handler error:", error);
      return errorResponse(message);
    }
  },
};

interface CachedRecipes {
  recipes: SpoonacularRecipe[];
  cuisine: string;
  fetchedAt: number;
}

async function getCacheInfo(env: Env): Promise<{ cached_count: number; cuisine: string } | null> {
  try {
    const cached = await env.RECIPE_CACHE.get(CACHE_KEY, "json") as CachedRecipes | null;
    if (cached) {
      return { cached_count: cached.recipes.length, cuisine: cached.cuisine };
    }
  } catch (e) {
    // KV not available or error
  }
  return null;
}

async function getOrFetchRecipe(env: Env, cuisine: string): Promise<SpoonacularRecipe | null> {
  try {
    // Try to get from cache first
    const cached = await env.RECIPE_CACHE.get(CACHE_KEY, "json") as CachedRecipes | null;

    if (cached && cached.recipes.length > 0) {
      // Pop one recipe from the cache
      const recipe = cached.recipes.shift()!;
      console.log(`Using cached recipe (${cached.recipes.length} remaining): ${recipe.title}`);

      // Update cache with remaining recipes
      if (cached.recipes.length > 0) {
        await env.RECIPE_CACHE.put(CACHE_KEY, JSON.stringify(cached));
      } else {
        // Cache is empty, delete it so we fetch fresh next time
        await env.RECIPE_CACHE.delete(CACHE_KEY);
        console.log("Cache exhausted, will fetch new batch on next request");
      }

      return recipe;
    }
  } catch (e) {
    console.log("KV cache not available, fetching directly:", e);
  }

  // Cache miss or empty - fetch a new batch
  console.log(`Fetching ${RECIPES_PER_FETCH} new recipes for cuisine: ${cuisine}`);
  const recipes = await fetchRandomRecipes(env.SPOONACULAR_API_KEY, cuisine, RECIPES_PER_FETCH);

  if (!recipes || recipes.length === 0) {
    return null;
  }

  // Take the first recipe to return
  const recipe = recipes.shift()!;

  // Cache the rest for future requests
  if (recipes.length > 0) {
    try {
      const cacheData: CachedRecipes = {
        recipes,
        cuisine,
        fetchedAt: Date.now(),
      };
      await env.RECIPE_CACHE.put(CACHE_KEY, JSON.stringify(cacheData));
      console.log(`Cached ${recipes.length} recipes for future requests`);
    } catch (e) {
      console.log("Failed to cache recipes:", e);
    }
  }

  return recipe;
}

async function fetchRandomRecipes(
  apiKey: string,
  cuisine: string,
  count: number = 1
): Promise<SpoonacularRecipe[]> {
  const params = new URLSearchParams({
    apiKey,
    number: count.toString(),
    cuisine,
    instructionsRequired: "true",
    addRecipeInformation: "true",
    fillIngredients: "true",
    includeNutrition: "false",
    tags: "main course",
  });

  console.log(`Calling Spoonacular API for ${count} ${cuisine} recipes...`);

  const response = await fetch(
    `https://api.spoonacular.com/recipes/random?${params}`
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Spoonacular API error: ${response.status} - ${errorBody}`);
    return [];
  }

  const data = (await response.json()) as SpoonacularResponse;
  console.log(`Spoonacular returned ${data.recipes?.length || 0} recipes`);
  return data.recipes || [];
}

async function formatWithGPT(
  apiKey: string,
  recipe: SpoonacularRecipe,
  requestedCuisine: string
): Promise<{
  title: string;
  ingredients: string;
  instructions: string;
  cuisine: string;
  cook_time: string;
}> {
  const ingredientList = recipe.extendedIngredients
    .map((i) => i.original)
    .join("\n");

  const prompt = `You are formatting a recipe for a small e-ink display. Be extremely concise.

Recipe: ${recipe.title}
Requested Cuisine: ${requestedCuisine}
Cuisines from API: ${recipe.cuisines?.join(", ") || "Unknown"}

Ingredients:
${ingredientList}

Instructions:
${recipe.instructions || "No instructions provided"}

Please provide:
1. TITLE: A clear, appetizing title focusing on the FOOD itself. Remove cooking method terms (like "foil packs", "sheet pan", "one pot", "instant pot", "slow cooker", "skillet"). Focus on main ingredients and flavors. Remove brand names. Keep it concise (max 6 words). Example: "Garlic Lemon Shrimp Foil Packs" → "Garlic Lemon Shrimp".
2. INGREDIENTS: List ALL key ingredients with amounts (max 15 items). Include the main protein, vegetables, sauces, spices, and any sides mentioned. Don't skip anything important! e.g., "3lb chicken thighs, 1 tbsp coconut oil, 6 tbsp curry powder, 1 large green pepper, 1/2 onion, 3 scallions, 1 scotch bonnet pepper, 2 sweet potatoes, 1 tsp allspice, 2 tsp black pepper, 1 1/2 tsp salt, 2 cups water"
3. INSTRUCTIONS: Summarize the cooking method in 3-4 sentences (max 80 words total). Include key steps and techniques.
4. COOK_TIME: Estimate total time to make the recipe based ONLY on the ingredients and instructions above. Do NOT use any time info from other sources. Return a short string like "45 min", "1 hr 30 min", or "2 hrs".
5. CUISINE: Determine the ACTUAL cuisine based on the dish's ingredients, cooking techniques, and origin - NOT the requested cuisine. If it's Southern US, prefer a specific label like "Cajun", "Creole", "Southern", or "Soul Food" instead of "American" when appropriate. Ignore brand names (like Chobani, Kraft, etc). If it isn't clearly regional, say "American" or the correct origin. Be accurate.

Respond in this exact JSON format:
{"title": "...", "ingredients": "...", "instructions": "...", "cook_time": "...", "cuisine": "..."}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2-chat-latest",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("=== OpenAI API ERROR ===");
    console.error(`Status: ${response.status}`);
    console.error(`Recipe: ${recipe.title} (ID: ${recipe.id})`);
    console.error(`Error body: ${errorBody}`);
    console.error(`Prompt length: ${prompt.length} chars`);
    console.error("========================");
    // Fallback to basic formatting
    return {
      title: recipe.title,
      ingredients: recipe.extendedIngredients
        .slice(0, 15)
        .map((i) => i.name)
        .join(", "),
      instructions: createFallbackInstructions(recipe),
      cook_time: `${recipe.readyInMinutes || "?"} min`,
      cuisine: requestedCuisine,
    };
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    error?: { message: string; type: string; code: string };
  };

  // Log token usage for monitoring
  if (data.usage) {
    console.log(`GPT tokens used - prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens}, total: ${data.usage.total_tokens}`);
  }

  // Check for API-level errors in the response body
  if (data.error) {
    console.error("=== OpenAI API RESPONSE ERROR ===");
    console.error(`Error type: ${data.error.type}`);
    console.error(`Error code: ${data.error.code}`);
    console.error(`Error message: ${data.error.message}`);
    console.error(`Recipe: ${recipe.title} (ID: ${recipe.id})`);
    console.error("=================================");
    return {
      title: recipe.title,
      ingredients: recipe.extendedIngredients
        .slice(0, 15)
        .map((i) => i.name)
        .join(", "),
      instructions: createFallbackInstructions(recipe),
      cook_time: `${recipe.readyInMinutes || "?"} min`,
      cuisine: requestedCuisine,
    };
  }

  const content = data.choices?.[0]?.message?.content || "";

  if (!content) {
    console.error("=== GPT EMPTY RESPONSE ===");
    console.error(`Recipe: ${recipe.title} (ID: ${recipe.id})`);
    console.error(`Full API response: ${JSON.stringify(data)}`);
    console.error("==========================");
    return {
      title: recipe.title,
      ingredients: recipe.extendedIngredients
        .slice(0, 15)
        .map((i) => i.name)
        .join(", "),
      instructions: createFallbackInstructions(recipe),
      cook_time: `${recipe.readyInMinutes || "?"} min`,
      cuisine: requestedCuisine,
    };
  }

  console.log(`GPT response received (${content.length} chars)`);

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`GPT formatting successful for: ${parsed.title}`);
      return parsed;
    } else {
      console.error("=== GPT JSON EXTRACTION FAILED ===");
      console.error(`Recipe: ${recipe.title} (ID: ${recipe.id})`);
      console.error(`No JSON found in response: ${content}`);
      console.error("==================================");
    }
  } catch (e) {
    console.error("=== GPT JSON PARSE FAILED ===");
    console.error(`Recipe: ${recipe.title} (ID: ${recipe.id})`);
    console.error(`Parse error: ${e}`);
    console.error(`Content: ${content}`);
    console.error("=============================");
  }

  // Fallback
  return {
    title: recipe.title,
    ingredients: recipe.extendedIngredients
      .slice(0, 15)
      .map((i) => i.name)
      .join(", "),
    instructions: createFallbackInstructions(recipe),
    cook_time: `${recipe.readyInMinutes || "?"} min`,
    cuisine: requestedCuisine,
  };
}


function createFallbackInstructions(recipe: SpoonacularRecipe): string {
  // Try to extract something useful from raw instructions
  if (!recipe.instructions) {
    return "Instructions not available for this recipe.";
  }

  // Strip HTML tags
  const plainText = recipe.instructions
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) {
    return "Instructions not available for this recipe.";
  }

  // Get first ~150 chars ending at a sentence or word boundary
  if (plainText.length <= 150) {
    return plainText;
  }

  // Try to end at a sentence
  const truncated = plainText.slice(0, 150);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > 80) {
    return truncated.slice(0, lastPeriod + 1);
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.slice(0, lastSpace) + "...";
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
