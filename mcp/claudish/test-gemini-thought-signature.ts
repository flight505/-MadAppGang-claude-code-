/**
 * Isolated test to verify OpenRouter behavior with Gemini thought signatures
 *
 * This test makes a direct API call to OpenRouter with a Gemini model,
 * requests a tool call, and logs the FULL raw response to see if
 * extra_content.google.thought_signature is present.
 */

import { config } from "./src/config.js";

// Test configuration
const MODEL = "google/gemini-3-pro-preview";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

async function testGeminiThoughtSignatures() {
  console.log("=".repeat(80));
  console.log("Testing OpenRouter Gemini API for thought signatures");
  console.log("=".repeat(80));
  console.log(`Model: ${MODEL}`);
  console.log(`API: ${API_URL}`);
  console.log("");

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: OPENROUTER_API_KEY environment variable not set");
    console.error("Please set it with: export OPENROUTER_API_KEY='your-key-here'");
    process.exit(1);
  }

  console.log("✅ API key found");
  console.log("");

  // Prepare the request payload
  const payload = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: "List the files in the current directory using the Bash tool with command 'ls -la'"
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "Bash",
          description: "Execute a bash command",
          parameters: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The bash command to execute"
              }
            },
            required: ["command"]
          }
        }
      }
    ],
    tool_choice: "auto",
    stream: true, // Stream to see if signatures appear in streaming response
    temperature: 1
  };

  console.log("📤 Sending request to OpenRouter...");
  console.log("");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/MadAppGang/claude-code",
        "X-Title": "Claude Code Proxy Test"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error("Response body:", errorText);
      process.exit(1);
    }

    console.log("✅ Request successful");
    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Content-Type: ${response.headers.get("content-type")}`);
    console.log("");
    console.log("=".repeat(80));
    console.log("RAW STREAMING RESPONSE (first 20 chunks with tool_calls):");
    console.log("=".repeat(80));
    console.log("");

    const reader = response.body?.getReader();
    if (!reader) {
      console.error("❌ Failed to get response reader");
      process.exit(1);
    }

    const decoder = new TextDecoder();
    let chunksProcessed = 0;
    let toolCallChunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunksProcessed++;
      const chunkText = decoder.decode(value, { stream: true });
      const lines = chunkText.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);

          // Skip [DONE] marker
          if (data === "[DONE]") {
            console.log("\n✅ Received [DONE] marker");
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Log entire chunk if it contains tool_calls
            const hasToolCalls = !!parsed.choices?.[0]?.delta?.tool_calls;

            if (hasToolCalls && toolCallChunks < 20) {
              toolCallChunks++;
              console.log("\n" + "-".repeat(80));
              console.log(`TOOL CALL CHUNK #${toolCallChunks}:`);
              console.log("-".repeat(80));
              console.log("FULL RAW JSON:");
              console.log(JSON.stringify(parsed, null, 2));
              console.log("");

              // Check specifically for extra_content
              const toolCalls = parsed.choices?.[0]?.delta?.tool_calls || [];
              for (const toolCall of toolCalls) {
                console.log("TOOL CALL STRUCTURE:");
                console.log(JSON.stringify(toolCall, null, 2));
                console.log("");

                if (toolCall.extra_content) {
                  console.log("✅ FOUND extra_content:");
                  console.log(JSON.stringify(toolCall.extra_content, null, 2));
                } else {
                  console.log("❌ NO extra_content field found in tool_call");
                }

                if (toolCall.extra_content?.google?.thought_signature) {
                  console.log("✅ FOUND thought_signature:");
                  console.log(`Signature: ${toolCall.extra_content.google.thought_signature}`);
                } else {
                  console.log("❌ NO thought_signature found");
                }
              }
            }
          } catch (parseError) {
            console.error("❌ Failed to parse JSON:", parseError);
            console.error("Raw data:", data);
          }
        }
      }

      if (chunksProcessed > 50) {
        console.log("\n⚠️  Processed 50 chunks, stopping (too much output)");
        break;
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("TEST SUMMARY:");
    console.log("=".repeat(80));
    console.log(`Total chunks processed: ${chunksProcessed}`);
    console.log(`Tool call chunks found: ${toolCallChunks}`);
    console.log("");

    if (toolCallChunks === 0) {
      console.log("⚠️  No tool call chunks found - model may not have called a tool");
    } else {
      console.log("Check the output above to see if extra_content.thought_signature was present");
    }

    console.log("");
    console.log("CONCLUSION:");
    console.log("If NO thought_signatures were found in the raw response,");
    console.log("this confirms OpenRouter is stripping them from Gemini's responses.");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testGeminiThoughtSignatures()
  .then(() => {
    console.log("\n✅ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
