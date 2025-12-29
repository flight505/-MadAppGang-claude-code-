#!/bin/bash
# =============================================================================
# AUTO-REINDEX HOOK - Background reindexing after file changes (v1.0.0)
# =============================================================================
# This PostToolUse hook runs after Write or Edit tools complete.
# It triggers claudemem index in the background for code file changes.
# Uses debouncing (30s) to avoid multiple concurrent reindex operations.
# POSIX-compatible - works on macOS and Linux.
# =============================================================================

set -euo pipefail

# =============================================================================
# SECTION 1: CONFIGURATION
# =============================================================================

# File extensions to trigger reindex (code files only)
CODE_EXTENSIONS="ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|scala|swift|c|cpp|h|hpp|cs|php|vue|svelte"

# Debounce interval in seconds (avoid reindexing too frequently)
DEBOUNCE_SECONDS=30

# Log file for debugging (set to /dev/null to disable)
LOG_FILE="${CLAUDEMEM_REINDEX_LOG:-/dev/null}"

log() {
  [ "$LOG_FILE" != "/dev/null" ] && echo "[$(date)] $1" >> "$LOG_FILE"
}

# =============================================================================
# SECTION 2: READ INPUT AND EXTRACT FILE PATH
# =============================================================================

# Read JSON input from stdin
INPUT=$(cat)

# Extract file path from tool response (more reliable) or tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  # No file path - not a file operation we care about
  exit 0
fi

# =============================================================================
# SECTION 3: CHECK IF FILE IS A CODE FILE
# =============================================================================

# Get file extension
EXTENSION="${FILE_PATH##*.}"

# Check if extension matches code files
if ! echo "$EXTENSION" | grep -qiE "^($CODE_EXTENSIONS)$"; then
  # Not a code file - skip reindexing
  exit 0
fi

# =============================================================================
# SECTION 4: CHECK PREREQUISITES
# =============================================================================

# Check if claudemem is installed
if ! command -v claudemem &>/dev/null; then
  exit 0
fi

# Get working directory from hook input
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

# Check if project is indexed (has .claudemem directory)
if [ ! -d "$CWD/.claudemem" ]; then
  exit 0
fi

# =============================================================================
# SECTION 5: DEBOUNCING
# =============================================================================

DEBOUNCE_FILE="$CWD/.claudemem/.reindex-timestamp"
LOCK_FILE="$CWD/.claudemem/.reindex-lock"

# Check debounce timestamp
if [ -f "$DEBOUNCE_FILE" ]; then
  LAST_REINDEX=$(cat "$DEBOUNCE_FILE" 2>/dev/null || echo "0")
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - LAST_REINDEX))

  if [ "$ELAPSED" -lt "$DEBOUNCE_SECONDS" ]; then
    # Too soon since last reindex - skip
    log "Debounced: ${ELAPSED}s < ${DEBOUNCE_SECONDS}s"
    exit 0
  fi
fi

# =============================================================================
# SECTION 6: PORTABLE LOCKING (works on macOS and Linux)
# =============================================================================

# Check if lock file exists and contains a running PID
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    # Process is still running - skip
    log "Skipped: reindex already running (PID $LOCK_PID)"
    exit 0
  fi
  # Stale lock file - remove it
  rm -f "$LOCK_FILE" 2>/dev/null
fi

# =============================================================================
# SECTION 7: TRIGGER BACKGROUND REINDEX
# =============================================================================

# Update debounce timestamp
date +%s > "$DEBOUNCE_FILE"

# Log the trigger
log "Triggered by: $FILE_PATH"

# Run reindex in background and write PID to lock file
(
  cd "$CWD"
  echo $$ > "$LOCK_FILE"

  # Run claudemem index
  claudemem index --quiet >/dev/null 2>&1 || true

  # Clean up lock file
  rm -f "$LOCK_FILE" 2>/dev/null
) &

# Disown to fully detach from shell
disown 2>/dev/null || true

# Always exit successfully - never block Claude
exit 0
