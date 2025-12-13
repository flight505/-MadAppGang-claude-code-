#!/bin/bash
# =============================================================================
# SESSION START HOOK - CHECK CLAUDEMEM STATUS
# =============================================================================
# This hook runs at the start of each Claude Code session.
# It checks if claudemem is installed and indexed, providing guidance if not.
# =============================================================================

set -euo pipefail

# Check if claudemem is installed
if ! command -v claudemem &>/dev/null; then
  cat << 'EOF' >&3
{
  "additionalContext": "⚠️ **claudemem not installed**\n\nThe code-analysis plugin uses semantic search. Install with:\n```bash\nnpm install -g claude-codemem\nclaudemem init    # Configure API key\nclaudemem index   # Index this project\n```\n\nUntil indexed, Grep/Glob will work normally."
}
EOF
  exit 0
fi

# Check if indexed in current directory
if ! claudemem status 2>/dev/null | grep -qE "[0-9]+ chunks"; then
  cat << 'EOF' >&3
{
  "additionalContext": "💡 **claudemem not indexed for this project**\n\nRun `claudemem index` to enable semantic search.\nOnce indexed, Grep will be automatically replaced with claudemem."
}
EOF
  exit 0
fi

# Get index stats for context
CHUNK_COUNT=$(claudemem status 2>/dev/null | grep -oE "[0-9]+ chunks" | head -1 || echo "unknown")

cat << EOF >&3
{
  "additionalContext": "✅ **claudemem active** ($CHUNK_COUNT)\n\nGrep/rg/find will be replaced with semantic search automatically."
}
EOF

exit 0
