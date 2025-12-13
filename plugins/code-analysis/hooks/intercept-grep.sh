#!/bin/bash
# =============================================================================
# INTERCEPT GREP → REPLACE WITH CLAUDEMEM SEMANTIC SEARCH
# =============================================================================
# This hook intercepts the Grep tool and replaces it with claudemem search.
# When claudemem is indexed, Grep is blocked and semantic results are returned.
# When claudemem is not indexed, Grep is allowed with a warning.
# =============================================================================

set -euo pipefail

# Read tool input from stdin
TOOL_INPUT=$(cat)
PATTERN=$(echo "$TOOL_INPUT" | jq -r '.pattern // empty')

# Skip if empty pattern
if [ -z "$PATTERN" ]; then
  exit 0
fi

# Check if claudemem is installed
if ! command -v claudemem &>/dev/null; then
  # Not installed - allow grep
  exit 0
fi

# Check if claudemem is indexed
if ! claudemem status 2>/dev/null | grep -qE "[0-9]+ chunks"; then
  # Not indexed - allow grep with warning
  cat << 'EOF' >&3
{
  "additionalContext": "⚠️ **claudemem not indexed** - Grep allowed as fallback.\n\nFor semantic search, run:\n```bash\nclaudemem index\n```"
}
EOF
  exit 0
fi

# === CLAUDEMEM IS INDEXED - REPLACE GREP ===

# Run claudemem search
RESULTS=$(claudemem search "$PATTERN" -n 15 2>/dev/null || echo "No results found")

# Escape special characters for JSON
RESULTS_ESCAPED=$(echo "$RESULTS" | jq -Rs .)
PATTERN_ESCAPED=$(echo "$PATTERN" | jq -Rs .)

# Return results and block grep
cat << EOF >&3
{
  "additionalContext": "🔍 **CLAUDEMEM SEARCH** (Grep intercepted)\n\n**Query:** ${PATTERN_ESCAPED}\n\n${RESULTS_ESCAPED}\n\n---\n✅ Semantic search complete. Grep was blocked because claudemem is indexed.",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Grep replaced with claudemem semantic search. Results provided in context above."
  }
}
EOF

exit 0
