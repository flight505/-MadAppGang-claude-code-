#!/bin/bash
# =============================================================================
# SUBAGENT STOP HOOK - CHECK STATISTICS COLLECTION
# =============================================================================
# This hook runs when a subagent completes. It checks if the agent was doing
# multi-model validation and reminds about statistics collection if needed.
# =============================================================================

set -euo pipefail

# Read tool input (contains agent output and metadata)
TOOL_INPUT=$(cat)

# Extract agent output to check for multi-model patterns
AGENT_OUTPUT=$(echo "$TOOL_INPUT" | jq -r '.output // empty' 2>/dev/null || echo "")

# Check if this looks like a multi-model validation task
# Look for patterns that indicate multi-model work
is_multi_model() {
  local output="$1"

  # Check for common multi-model indicators
  if echo "$output" | grep -qiE "grok|gemini|gpt-5|deepseek|claudish|multi-model|parallel.*review|consensus"; then
    return 0
  fi

  # Check for multiple model mentions
  local model_count=$(echo "$output" | grep -oiE "(grok|gemini|gpt-5|deepseek|qwen|mistral)" | wc -l)
  if [ "$model_count" -ge 2 ]; then
    return 0
  fi

  return 1
}

# Check if statistics were mentioned/saved
has_statistics() {
  local output="$1"

  # Check for statistics indicators
  if echo "$output" | grep -qiE "llm-performance\.json|track_model_performance|record_session_stats|Model Performance|Session Statistics|Speedup:"; then
    return 0
  fi

  return 1
}

# Check if the performance file exists and was recently updated
check_perf_file() {
  local perf_file="ai-docs/llm-performance.json"

  if [ ! -f "$perf_file" ]; then
    return 1
  fi

  # Check if updated in last 5 minutes
  local now=$(date +%s)
  local file_mod=$(stat -f %m "$perf_file" 2>/dev/null || stat -c %Y "$perf_file" 2>/dev/null || echo 0)
  local age=$((now - file_mod))

  if [ "$age" -lt 300 ]; then
    return 0
  fi

  return 1
}

# Main logic
if [ -z "$AGENT_OUTPUT" ]; then
  # No output to analyze
  exit 0
fi

# Check if this was multi-model validation
if is_multi_model "$AGENT_OUTPUT"; then
  # This looks like multi-model work - check if statistics were collected

  if ! has_statistics "$AGENT_OUTPUT"; then
    # Statistics not mentioned in output - check if file was updated
    if ! check_perf_file; then
      # Neither mentioned nor file updated - warn!
      cat << 'EOF' >&3
{
  "additionalContext": "⚠️ **STATISTICS COLLECTION REMINDER**\n\nThis task appears to involve multi-model validation but statistics may not have been collected.\n\n**Required steps (from orchestration:multi-model-validation skill):**\n\n1. ☐ `track_model_performance()` for each model\n2. ☐ `record_session_stats()` for session summary\n3. ☐ Display performance table with Time/Issues/Quality/Cost\n4. ☐ Verify `ai-docs/llm-performance.json` was updated\n\n**If you haven't done these, the review is INCOMPLETE.**\n\nSee: `orchestration:multi-model-validation` → MANDATORY: Statistics Collection Checklist"
}
EOF
      exit 0
    fi
  fi

  # Statistics appear to be collected - provide positive feedback
  cat << 'EOF' >&3
{
  "additionalContext": "✓ Multi-model validation detected. Statistics collection appears complete."
}
EOF
fi

exit 0
