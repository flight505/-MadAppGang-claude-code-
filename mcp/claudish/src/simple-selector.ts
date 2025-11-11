import { createInterface } from "readline";
import { MODEL_INFO } from "./config.js";
import { OPENROUTER_MODELS, type OpenRouterModel } from "./types.js";

/**
 * Simple console-based model selector (no Ink/React)
 * Uses readline which properly cleans up stdin
 */
export async function selectModelInteractively(): Promise<OpenRouterModel | string> {
  return new Promise((resolve) => {
    console.log("\n\x1b[1m\x1b[36mSelect an OpenRouter model:\x1b[0m\n");

    // Display models
    OPENROUTER_MODELS.forEach((model, index) => {
      const info = MODEL_INFO[model as keyof typeof MODEL_INFO];
      const displayName = info ? info.name : model;
      const description = info ? info.description : "Custom model entry";
      const provider = info ? info.provider : "";

      console.log(`  ${index + 1}. \x1b[1m${displayName}\x1b[0m`);
      if (provider && provider !== "Custom") {
        console.log(`     \x1b[2m${provider} - ${description}\x1b[0m`);
      } else {
        console.log(`     \x1b[2m${description}\x1b[0m`);
      }
      console.log("");
    });

    console.log(`\x1b[2mEnter number (1-${OPENROUTER_MODELS.length}) or 'q' to quit:\x1b[0m`);

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // CRITICAL: Don't use terminal mode to avoid stdin interference
    });

    let selectedModel: string | null = null;

    rl.on("line", (input) => {
      const trimmed = input.trim();

      // Handle quit
      if (trimmed.toLowerCase() === "q") {
        rl.close();
        process.exit(0);
      }

      // Parse selection
      const selection = parseInt(trimmed, 10);
      if (isNaN(selection) || selection < 1 || selection > OPENROUTER_MODELS.length) {
        console.log(`\x1b[31mInvalid selection. Please enter 1-${OPENROUTER_MODELS.length}\x1b[0m`);
        return;
      }

      const model = OPENROUTER_MODELS[selection - 1];

      // Handle custom model
      if (model === "custom") {
        rl.close();

        console.log("\n\x1b[1m\x1b[36mEnter custom OpenRouter model ID:\x1b[0m");
        const customRl = createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: false,
        });

        let customModel: string | null = null;

        customRl.on("line", (customInput) => {
          customModel = customInput.trim();
          customRl.close();
        });

        customRl.on("close", () => {
          // CRITICAL: Wait for readline to fully detach before resolving
          // Force stdin to clean state
          process.stdin.pause();
          process.stdin.removeAllListeners("data");
          process.stdin.removeAllListeners("end");
          process.stdin.removeAllListeners("error");
          process.stdin.removeAllListeners("readable");

          if (process.stdin.isTTY && process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
          }

          setTimeout(() => {
            if (customModel) {
              resolve(customModel);
            } else {
              console.error("\x1b[31mError: Model ID cannot be empty\x1b[0m");
              process.exit(1);
            }
          }, 200);
        });
      } else {
        selectedModel = model;
        rl.close();
      }
    });

    rl.on("close", () => {
      // CRITICAL: Only resolve AFTER readline has fully closed
      // This ensures stdin is completely detached before spawning Claude Code
      if (selectedModel) {
        // Force stdin to clean state
        // Pause to stop all event processing
        process.stdin.pause();

        // Remove ALL readline-related listeners
        process.stdin.removeAllListeners("data");
        process.stdin.removeAllListeners("end");
        process.stdin.removeAllListeners("error");
        process.stdin.removeAllListeners("readable");

        // Ensure not in raw mode
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }

        // Wait for stdin to fully detach (longer delay)
        setTimeout(() => {
          resolve(selectedModel);
        }, 200); // 200ms delay for complete cleanup
      }
    });
  });
}
