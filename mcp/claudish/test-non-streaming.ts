/**
 * Test non-streaming mode to see if extra_content is present
 */

import { config } from "./src/config.js";

const MODEL = "google/gemini-3-pro-preview";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

async function testNonStreaming() {
  console.log("\n" + "=".repeat(80));
  console.log("Testing NON-STREAMING mode");
  console.log("=".repeat(80) + "\n");

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY not set\n");
    process.exit(1);
  }

  const payload = {
    model: MODEL,
    messages: [{ role: "user", content: "Run 'ls' command" }],
    tools: [{
      type: "function",
      function: {
        name: "Bash",
        description: "Execute bash command",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      }
    }],
    tool_choice: "auto",
    stream: false, // NON-STREAMING
    temperature: 1
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/MadAppGang/claude-code",
      "X-Title": "Claude Code Proxy"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error(`❌ HTTP ${response.status}: ${response.statusText}\n`);
    console.error(await response.text());
    process.exit(1);
  }

  const data = await response.json();
  console.log("✅ Response received\n");
  console.log("FULL RESPONSE:");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n");

  const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
  console.log(`Found ${toolCalls.length} tool call(s)\n`);

  for (const toolCall of toolCalls) {
    console.log("TOOL CALL:");
    console.log(JSON.stringify(toolCall, null, 2));
    console.log("\n");

    if (toolCall.extra_content?.google?.thought_signature) {
      console.log("✅ FOUND thought_signature!");
      console.log("Signature:", toolCall.extra_content.google.thought_signature);
    } else {
      console.log("❌ NO thought_signature in tool_call");
    }

    if (data.reasoning_details) {
      console.log("\nREASONING DETAILS FOUND:");
      console.log(JSON.stringify(data.reasoning_details, null, 2));
    }
  }
}

testNonStreaming().catch(console.error);
