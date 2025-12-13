#!/bin/bash
# =============================================================================
# INTERCEPT READ → WARN ON BULK READS (3+ FILES)
# =============================================================================
# This hook tracks file reads in a session and warns when 3+ files are read,
# suggesting claudemem semantic search as a more efficient alternative.
# Does NOT block - just provides helpful guidance.
# =============================================================================

set -euo pipefail

# Read tool input from stdin
TOOL_INPUT=$(cat)
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')

# Skip if empty path
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Check if claudemem is available
if ! command -v claudemem &>/dev/null; then
  exit 0
fi

if ! claudemem status 2>/dev/null | grep -qE "[0-9]+ chunks"; then
  # Not indexed - no tracking needed
  exit 0
fi

# === TRACK READS IN SESSION ===

# Use a session-specific tracker file
# SESSION_KEY is based on working directory to isolate projects
SESSION_KEY=$(echo "$PWD" | md5sum | cut -c1-8)
TRACKER="/tmp/claude-read-tracker-$SESSION_KEY"

# Cleanup old trackers (older than 30 minutes)
find /tmp -name "claude-read-tracker-*" -mmin +30 -delete 2>/dev/null || true

# Track this read
echo "$FILE_PATH" >> "$TRACKER"

# Count unique directories being read from
READ_COUNT=$(wc -l < "$TRACKER" 2>/dev/null | tr -d ' ')
UNIQUE_DIRS=$(cat "$TRACKER" | xargs -I{} dirname {} 2>/dev/null | sort -u | wc -l | tr -d ' ')

# === WARN AFTER 3+ READS ===

if [ "$READ_COUNT" -ge 3 ]; then
  # Get the directories being read
  DIR_LIST=$(cat "$TRACKER" | xargs -I{} dirname {} 2>/dev/null | sort -u | head -3 | tr '\n' ', ' | sed 's/,$//')

  cat << EOF >&3
{
  "additionalContext": "⚠️ **Bulk Read Warning** ($READ_COUNT files from $UNIQUE_DIRS dirs)\n\nDirs: \`$DIR_LIST\`\n\nConsider using semantic search instead:\n\`\`\`bash\nclaudemem search \"concept you're investigating\"\n\`\`\`\n\nSemantic search provides ranked, relevant results vs reading files one-by-one."
}
EOF
fi

# Always allow reads (soft warning only)
exit 0
