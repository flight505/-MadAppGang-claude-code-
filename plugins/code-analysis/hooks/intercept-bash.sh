#!/bin/bash
# =============================================================================
# INTERCEPT BASH GREP/RG/FIND → REPLACE WITH CLAUDEMEM
# =============================================================================
# This hook intercepts Bash commands that run grep, rg, ripgrep, ag, ack,
# git grep, or find with grep. Replaces with claudemem semantic search.
# =============================================================================

set -euo pipefail

# Read tool input from stdin
TOOL_INPUT=$(cat)
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // empty')

# Skip if empty command
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Detect search commands: grep, rg, ripgrep, ag, ack, git grep, find with grep
# Pattern matches: grep, rg, etc. as standalone commands or with paths
if ! echo "$COMMAND" | grep -qiE '(^|\s|/|;|&&|\|)(grep|rg|ripgrep|ag|ack)(\s|$)|git\s+grep|find\s+.*-exec.*grep'; then
  # Not a search command - allow
  exit 0
fi

# Check if claudemem is installed
if ! command -v claudemem &>/dev/null; then
  exit 0
fi

# Check if claudemem is indexed
if ! claudemem status 2>/dev/null | grep -qE "[0-9]+ chunks"; then
  # Not indexed - allow with warning
  cat << 'EOF' >&3
{
  "additionalContext": "⚠️ **claudemem not indexed** - Search command allowed as fallback.\n\nFor semantic search, run: `claudemem index`"
}
EOF
  exit 0
fi

# === CLAUDEMEM IS INDEXED - REPLACE BASH SEARCH ===

# Extract search pattern (best effort)
# Handles various patterns: grep "pattern", grep 'pattern', grep pattern, rg pattern
PATTERN=""

# Try to extract quoted pattern first
PATTERN=$(echo "$COMMAND" | grep -oE '"[^"]+"' | head -1 | tr -d '"')

# If no quoted pattern, try single quotes
if [ -z "$PATTERN" ]; then
  PATTERN=$(echo "$COMMAND" | grep -oE "'[^']+'" | head -1 | tr -d "'")
fi

# If still no pattern, try to get the argument after grep/rg
if [ -z "$PATTERN" ]; then
  PATTERN=$(echo "$COMMAND" | sed -E 's/.*(grep|rg|ag|ack)\s+(-[a-zA-Z]+\s+)*([^\s|>]+).*/\3/' | head -1)
fi

# Fallback
if [ -z "$PATTERN" ] || [ "$PATTERN" = "$COMMAND" ]; then
  PATTERN="code pattern"
fi

# Run claudemem search
RESULTS=$(claudemem search "$PATTERN" -n 15 2>/dev/null || echo "No results found")

# Escape for JSON
RESULTS_ESCAPED=$(echo "$RESULTS" | jq -Rs .)
COMMAND_ESCAPED=$(echo "$COMMAND" | jq -Rs .)
PATTERN_ESCAPED=$(echo "$PATTERN" | jq -Rs .)

# Return results and block
cat << EOF >&3
{
  "additionalContext": "🔍 **CLAUDEMEM SEARCH** (Bash search intercepted)\n\n**Blocked command:** ${COMMAND_ESCAPED}\n**Extracted query:** ${PATTERN_ESCAPED}\n\n${RESULTS_ESCAPED}\n\n---\n✅ Semantic search complete. Use \`claudemem search \"query\"\` directly.",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "grep/rg/find blocked. claudemem semantic results provided in context above."
  }
}
EOF

exit 0
