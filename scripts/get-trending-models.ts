#!/usr/bin/env bun

/**
 * Fetch trending programming models from OpenRouter
 *
 * Usage:
 *   bun run scripts/get-trending-models.ts
 *   bun run scripts/get-trending-models.ts --help
 *
 * Output:
 *   Structured JSON to stdout containing top 9 trending models
 *   with details (context length, pricing, token usage)
 *
 * Exit Codes:
 *   0 - Success
 *   1 - Fetch/parse error
 */

// ============================================================================
// Types
// ============================================================================

interface RankingData {
  x: string; // Week ending date (YYYY-MM-DD)
  ys: Record<string, number>; // Model ID -> Token usage
}

interface RankingResponse {
  data: RankingData[];
}

interface ModelApiResponse {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
}

interface ModelDetails {
  id: string;
  name: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
    promptPer1M: number;
    completionPer1M: number;
  };
  maxCompletionTokens: number;
}

interface TrendingModel extends ModelDetails {
  rank: number;
  tokenUsage: number;
}

interface TrendingModelsOutput {
  metadata: {
    fetchedAt: string;
    weekEnding: string;
    category: "programming";
    view: "trending";
  };
  models: TrendingModel[];
  summary: {
    totalTokens: number;
    topProvider: string;
    averageContextLength: number;
    priceRange: {
      min: number;
      max: number;
      unit: "USD per 1M tokens";
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

const RANKINGS_URL =
  "https://openrouter.ai/rankings?category=programming&view=trending&_rsc=2nz0s";
const MODELS_API_URL = "https://openrouter.ai/api/v1/models";
const TOP_N_MODELS = 9;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Fetch trending model rankings from OpenRouter
 * Parses React Server Component (RSC) streaming format
 *
 * @returns Latest week's ranking data
 * @throws Error if fetch fails or data cannot be parsed
 */
async function fetchRankings(): Promise<RankingData> {
  try {
    const response = await fetch(RANKINGS_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();

    // Extract JSON data from RSC format
    // Pattern: 1b:["$","$L25",null,{"data":[...]}]
    const match = text.match(/1b:\["[^"]+","[^"]+",null,(\{.*?\})\]/s);

    if (!match || !match[1]) {
      throw new Error("Failed to extract JSON from RSC format");
    }

    // Parse extracted JSON
    const data: RankingResponse = JSON.parse(match[1]);

    // Validate structure
    if (
      !data.data ||
      !Array.isArray(data.data) ||
      data.data.length === 0 ||
      !data.data[0].x ||
      !data.data[0].ys
    ) {
      throw new Error("Invalid ranking data structure");
    }

    // Return most recent week (first item)
    return data.data[0];
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch rankings: ${error.message}`);
    }
    throw new Error("Failed to fetch rankings: Unknown error");
  }
}

/**
 * Fetch detailed information for a specific model from OpenRouter API
 *
 * @param modelId - Model identifier (e.g., "x-ai/grok-code-fast-1")
 * @param allModels - Cached API response to avoid redundant fetches
 * @returns Model details with pricing and context info
 */
async function fetchModelDetails(
  modelId: string,
  allModels: ModelApiResponse[]
): Promise<ModelDetails> {
  const model = allModels.find((m) => m.id === modelId);

  if (!model) {
    console.warn(`Warning: Model ${modelId} not found in API, using defaults`);
    return {
      id: modelId,
      name: modelId.split("/")[1] || modelId,
      contextLength: 0,
      pricing: {
        prompt: 0,
        completion: 0,
        promptPer1M: 0,
        completionPer1M: 0,
      },
      maxCompletionTokens: 0,
    };
  }

  const promptPrice = parseFloat(model.pricing.prompt);
  const completionPrice = parseFloat(model.pricing.completion);

  return {
    id: model.id,
    name: model.name,
    contextLength: model.context_length,
    pricing: {
      prompt: promptPrice,
      completion: completionPrice,
      promptPer1M: promptPrice * 1_000_000,
      completionPer1M: completionPrice * 1_000_000,
    },
    maxCompletionTokens: model.top_provider?.max_completion_tokens || 0,
  };
}

/**
 * Fetch all models from OpenRouter API
 * Cached to avoid redundant API calls when fetching details for multiple models
 *
 * @returns Array of all available models
 * @throws Error if fetch fails
 */
async function fetchAllModels(): Promise<ModelApiResponse[]> {
  try {
    const response = await fetch(MODELS_API_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid models API response structure");
    }

    return data.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch models API: ${error.message}`);
    }
    throw new Error("Failed to fetch models API: Unknown error");
  }
}

/**
 * Calculate aggregate statistics from trending models
 *
 * @param models - Array of trending models with details
 * @returns Summary statistics (total tokens, top provider, avg context, price range)
 */
function calculateSummary(
  models: TrendingModel[]
): TrendingModelsOutput["summary"] {
  const totalTokens = models.reduce((sum, m) => sum + m.tokenUsage, 0);

  // Find top provider (most models in top 9)
  const providerCounts = new Map<string, number>();
  for (const model of models) {
    const provider = model.id.split("/")[0];
    providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  }

  let topProvider = "unknown";
  let maxCount = 0;
  for (const [provider, count] of providerCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      topProvider = provider;
    }
  }

  // Calculate average context length
  const validContextLengths = models
    .map((m) => m.contextLength)
    .filter((c) => c > 0);
  const averageContextLength =
    validContextLengths.length > 0
      ? Math.round(
          validContextLengths.reduce((sum, c) => sum + c, 0) /
            validContextLengths.length
        )
      : 0;

  // Find price range (based on prompt pricing per 1M tokens)
  const prices = models
    .map((m) => m.pricing.promptPer1M)
    .filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    totalTokens,
    topProvider,
    averageContextLength,
    priceRange: {
      min: Math.round(minPrice * 100) / 100, // Round to 2 decimals
      max: Math.round(maxPrice * 100) / 100,
      unit: "USD per 1M tokens",
    },
  };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Fetch trending programming models from OpenRouter

USAGE:
  bun run scripts/get-trending-models.ts [OPTIONS]

OPTIONS:
  --help     Show this help message

OUTPUT:
  JSON to stdout containing top ${TOP_N_MODELS} trending models with:
  - Model ID, name, rank
  - Token usage (last week)
  - Context length and max completion tokens
  - Pricing (per token and per 1M tokens)
  - Summary statistics

EXAMPLES:
  # Fetch and display models
  bun run scripts/get-trending-models.ts

  # Save to file
  bun run scripts/get-trending-models.ts > trending-models.json

  # Pretty print with jq
  bun run scripts/get-trending-models.ts | jq '.'

EXIT CODES:
  0   Success
  1   Fetch or parse error
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Check for --help flag
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  try {
    // Step 1: Fetch rankings from OpenRouter
    console.error("Fetching trending model rankings...");
    const rankings = await fetchRankings();
    console.error(`Found data for week ending ${rankings.x}`);

    // Step 2: Extract top N models (exclude "Others")
    const modelEntries = Object.entries(rankings.ys)
      .filter(([name]) => name !== "Others")
      .slice(0, TOP_N_MODELS);

    console.error(`Extracting top ${modelEntries.length} models...`);

    // Step 3: Fetch all models from API (cached for efficiency)
    console.error("Fetching model details from API...");
    const allModels = await fetchAllModels();
    console.error(`Retrieved ${allModels.length} models from API`);

    // Step 4: Fetch details for each trending model (parallel)
    const modelsWithDetails = await Promise.all(
      modelEntries.map(async ([modelId, tokenUsage], index) => {
        const details = await fetchModelDetails(modelId, allModels);
        return {
          ...details,
          rank: index + 1,
          tokenUsage,
        };
      })
    );

    // Step 5: Calculate summary statistics
    const summary = calculateSummary(modelsWithDetails);

    // Step 6: Build output JSON
    const output: TrendingModelsOutput = {
      metadata: {
        fetchedAt: new Date().toISOString(),
        weekEnding: rankings.x,
        category: "programming",
        view: "trending",
      },
      models: modelsWithDetails,
      summary,
    };

    // Step 7: Write JSON to stdout
    console.log(JSON.stringify(output, null, 2));

    // Step 8: Print summary to stderr (for human readability)
    console.error("\n✓ Success!");
    console.error(`  Top model: ${modelsWithDetails[0].name}`);
    console.error(`  Total tokens: ${summary.totalTokens.toLocaleString()}`);
    console.error(`  Top provider: ${summary.topProvider}`);
    console.error(
      `  Price range: $${summary.priceRange.min}-$${summary.priceRange.max}/1M tokens`
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n✗ Error: ${error.message}`);
      console.error(
        "\nTroubleshooting:\n" +
          "  1. Check internet connection\n" +
          "  2. Verify OpenRouter site is accessible: https://openrouter.ai/rankings\n" +
          "  3. Check if page format has changed (RSC structure)\n" +
          "  4. Review error details above\n"
      );
    } else {
      console.error("\n✗ Unknown error occurred");
    }
    process.exit(1);
  }
}

// Execute main function
main();
