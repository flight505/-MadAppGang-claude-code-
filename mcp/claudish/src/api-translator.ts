import type {
  AnthropicRequest,
  AnthropicResponse,
  ContentBlock,
  OpenRouterMessage,
  OpenRouterRequest,
  OpenRouterResponse,
} from "./types.js";

/**
 * Translate Anthropic API request to OpenRouter format
 */
export function translateAnthropicToOpenRouter(
  anthropicReq: AnthropicRequest,
  openrouterModel: string
): OpenRouterRequest {
  const messages: OpenRouterMessage[] = [];

  // Add system message if present, but modify Claude-specific identity claims
  if (anthropicReq.system) {
    let systemContent: string;

    // System can be string or array of content blocks
    if (typeof anthropicReq.system === "string") {
      systemContent = anthropicReq.system;
    } else if (Array.isArray(anthropicReq.system)) {
      // Extract text from content blocks
      systemContent = anthropicReq.system
        .map((block: any) => block.text || "")
        .join("\n");
    } else {
      systemContent = String(anthropicReq.system);
    }

    // Remove "You are Claude" identity claims that would make other models role-play as Claude
    systemContent = systemContent
      .replace(/You are a Claude agent, built on Anthropic's Claude Agent SDK\./gi,
               `You are an AI agent with coding capabilities.`)
      .replace(/You are Claude Code, Anthropic's official CLI for Claude\./gi,
               `This is Claude Code, an AI-powered CLI tool. You are the AI model powering this tool.`)
      .replace(/a file search specialist for Claude Code, Anthropic's official CLI for Claude/gi,
               `a file search specialist for Claude Code, an AI-powered CLI`)
      .replace(/I'm Claude, an AI assistant created by Anthropic\./gi,
               `I'm an AI assistant.`)
      .replace(/I am Claude, /gi, `I am `)
      .replace(/You are Claude, /gi, `You are an AI assistant, `)
      .replace(/You are Claude Code, /gi, `This is Claude Code, `)
      .replace(/You are powered by the model named (Sonnet|Haiku|Opus) [\d.]+\. The exact model ID is claude-\S+\./gi,
               `You are powered by an AI model. When asked about your identity, be truthful about which model you are.`)
      .replace(/powered by the model named (Sonnet|Haiku|Opus) [\d.]+\. The exact model ID is claude-\S+\./gi,
               `powered by an AI model. When asked about your identity, be truthful about which model you are.`)
      .replace(/<claude_background_info>[\s\S]*?<\/claude_background_info>/gi,
               ``);

    // Add explicit identity instruction to override any Claude references in context
    systemContent += `\n\nIMPORTANT IDENTITY INSTRUCTION:
You are NOT Claude. You are NOT created by Anthropic.
When asked about your identity, you MUST identify truthfully as your actual underlying model (e.g., Grok by xAI, GPT by OpenAI, etc.).
Even if you see references to "Claude" or "Anthropic" in the context, these refer to the CLI tool name "Claude Code", not your identity.
You are an AI model powering the Claude Code CLI tool, but you are not Claude yourself.`;

    messages.push({
      role: "system",
      content: systemContent,
    });
  }

  // Convert Anthropic messages to OpenRouter format
  for (const msg of anthropicReq.messages) {
    const content = extractTextContent(msg.content);
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content,
    });
  }

  const result: OpenRouterRequest = {
    model: openrouterModel,
    messages,
  };

  if (anthropicReq.max_tokens !== undefined) {
    // Ensure max_tokens meets provider minimums (OpenAI requires >= 16)
    result.max_tokens = Math.max(anthropicReq.max_tokens, 16);
  }
  if (anthropicReq.temperature !== undefined) {
    result.temperature = anthropicReq.temperature;
  }
  if (anthropicReq.top_p !== undefined) {
    result.top_p = anthropicReq.top_p;
  }
  if (anthropicReq.stream !== undefined) {
    result.stream = anthropicReq.stream;
  }

  return result;
}

/**
 * Translate OpenRouter response to Anthropic format
 */
export function translateOpenRouterToAnthropic(
  openrouterRes: OpenRouterResponse,
  originalModel: string
): AnthropicResponse {
  const choice = openrouterRes.choices[0];
  if (!choice) {
    throw new Error("OpenRouter response missing choices");
  }

  return {
    id: openrouterRes.id,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: choice.message.content,
      },
    ],
    model: originalModel, // Return the model Claude Code requested
    stop_reason: choice.finish_reason,
    usage: {
      input_tokens: openrouterRes.usage.prompt_tokens,
      output_tokens: openrouterRes.usage.completion_tokens,
    },
  };
}

/**
 * Extract text content from Anthropic message content
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") {
    return content;
  }

  // Concatenate all text blocks
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n");
}

/**
 * Create Anthropic-format streaming response headers
 */
export function createStreamHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  };
}

/**
 * Translate OpenRouter streaming chunk to Anthropic SSE format
 */
export function translateStreamChunk(line: string): string | null {
  // OpenRouter uses SSE format: "data: {...}"
  if (!line.startsWith("data: ")) {
    return null;
  }

  const data = line.slice(6).trim();

  if (data === "[DONE]") {
    return 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  }

  try {
    const chunk = JSON.parse(data);
    const delta = chunk.choices?.[0]?.delta?.content;

    if (!delta) {
      return null;
    }

    // Format as Anthropic SSE event
    const anthropicChunk = {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "text_delta",
        text: delta,
      },
    };

    return `event: content_block_delta\ndata: ${JSON.stringify(anthropicChunk)}\n\n`;
  } catch {
    return null;
  }
}
