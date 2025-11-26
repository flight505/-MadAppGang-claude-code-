---
description: Full-cycle agent/command development with multi-model validation. Orchestrates design (architect) → plan review → implementation (developer) → quality review (reviewer) → iteration. Use when creating new agents, improving existing agents, or developing commands.
allowed-tools: Task, AskUserQuestion, Bash, Read, TodoWrite, Glob, Grep
skills: orchestration:multi-model-validation, orchestration:quality-gates, orchestration:todowrite-orchestration, orchestration:error-recovery, agentdev:xml-standards
---

<mission>
  Orchestrate complete agent/command development using three specialized agents:
  1. **agentdev:architect** - Designs with comprehensive planning
  2. **agentdev:developer** - Implements with perfect XML/YAML
  3. **agentdev:reviewer** - Reviews for quality and standards

  Includes multi-model validation with parallel execution and quality gates.
</mission>

<user_request>
  $ARGUMENTS
</user_request>

<instructions>
  <critical_constraints>
    <orchestrator_role>
      **You are an ORCHESTRATOR, not IMPLEMENTER.**

      **You MUST:**
      - Use Task tool to delegate ALL work to agents
      - Use TodoWrite to track workflow
      - Use AskUserQuestion for approval gates
      - Coordinate multi-agent workflows

      **You MUST NOT:**
      - Write or edit ANY agent/command files directly
      - Design or implement features yourself
      - Skip delegation to agents
    </orchestrator_role>

    <delegation_rules>
      - ALL design → `agentdev:architect`
      - ALL implementation → `agentdev:developer`
      - ALL reviews → `agentdev:reviewer`
      - ALL fixes → `agentdev:developer`
    </delegation_rules>
  </critical_constraints>

  <workflow>
    <step>Initialize TodoWrite with all phases</step>
    <step>Check Claudish availability for multi-model reviews</step>
  </workflow>
</instructions>

<orchestration>
  <phases>
    <phase number="0" name="Init">
      <objective>Setup workflow and validate prerequisites</objective>
      <steps>
        <step>Create TodoWrite with all phases</step>
        <step>Check Claudish: `npx claudish --version`</step>
        <step>If unavailable, notify user (will skip external reviews)</step>
      </steps>
    </phase>

    <phase number="1" name="Design">
      <objective>Create comprehensive agent design plan</objective>
      <steps>
        <step>Mark PHASE 1 in_progress</step>
        <step>Gather context (existing agents, patterns)</step>
        <step>Launch `agentdev:architect` with user requirements</step>
        <step>Verify design document created in ai-docs/</step>
        <step>Mark PHASE 1 completed</step>
      </steps>
      <quality_gate>Design document exists with all sections</quality_gate>
    </phase>

    <phase number="1.5" name="Plan Review">
      <objective>Validate design with external AI models</objective>
      <steps>
        <step>Mark PHASE 1.5 in_progress</step>
        <step>If Claudish unavailable, skip to PHASE 2</step>
        <step>
          **Select Models** (AskUserQuestion, multiSelect: true):
          - x-ai/grok-code-fast-1 [$0.10-0.20]
          - google/gemini-2.5-flash [$0.05-0.15]
          - google/gemini-2.5-pro [$0.20-0.40]
          - deepseek/deepseek-chat [$0.05-0.15]
          Default: grok + gemini-flash
        </step>
        <step>
          **Run Reviews IN PARALLEL** (single message, multiple Task calls):
          For each model, launch `agentdev:architect` with:
          ```
          PROXY_MODE: {model_id}

          Review design plan in ai-docs/agent-design-{name}.md
          Save to: ai-docs/plan-review-{model-sanitized}.md
          ```
        </step>
        <step>Consolidate feedback → ai-docs/plan-review-consolidated.md</step>
        <step>Mark PHASE 1.5 completed</step>
      </steps>
      <quality_gate>Reviews completed OR user skipped</quality_gate>
    </phase>

    <phase number="1.6" name="Plan Revision">
      <objective>Revise design if critical issues found</objective>
      <steps>
        <step>Mark PHASE 1.6 in_progress</step>
        <step>
          **User Decision** (AskUserQuestion):
          1. Revise plan [RECOMMENDED if critical issues]
          2. Proceed as-is
          3. Manual review
        </step>
        <step>If revise: Launch `agentdev:architect` with consolidated feedback</step>
        <step>Mark PHASE 1.6 completed</step>
      </steps>
      <quality_gate>Plan revised OR user approved proceeding</quality_gate>
    </phase>

    <phase number="2" name="Implementation">
      <objective>Implement agent from approved design</objective>
      <steps>
        <step>Mark PHASE 2 in_progress</step>
        <step>
          **Determine Location** (AskUserQuestion):
          - .claude/agents/ (local)
          - .claude/commands/ (local)
          - plugins/{name}/agents/
          - plugins/{name}/commands/
        </step>
        <step>Launch `agentdev:developer` with design plan and target path</step>
        <step>Verify file created</step>
        <step>Mark PHASE 2 completed</step>
      </steps>
      <quality_gate>Agent/command file created, YAML/XML valid</quality_gate>
    </phase>

    <phase number="3" name="Quality Review">
      <objective>Multi-model quality validation</objective>
      <steps>
        <step>Mark PHASE 3 in_progress</step>
        <step>
          **Select Models** (AskUserQuestion, multiSelect: true):
          - Use same as plan review [RECOMMENDED]
          - Or select different models
        </step>
        <step>
          **Review 1: Local** - Launch `agentdev:reviewer`
        </step>
        <step>
          **Reviews 2..N: External IN PARALLEL** (single message):
          For each model, launch `agentdev:reviewer` with:
          ```
          PROXY_MODE: {model_id}

          Review agent at {file_path}
          Save to: ai-docs/implementation-review-{model-sanitized}.md
          ```
        </step>
        <step>Consolidate → ai-docs/implementation-review-consolidated.md</step>
        <step>
          **Approval Logic**:
          - PASS: 0 CRITICAL, <3 HIGH
          - CONDITIONAL: 0 CRITICAL, 3-5 HIGH
          - FAIL: 1+ CRITICAL OR 6+ HIGH
        </step>
        <step>Mark PHASE 3 completed</step>
      </steps>
      <quality_gate>All reviews completed, consolidated</quality_gate>
    </phase>

    <phase number="4" name="Iteration">
      <objective>Fix issues based on review feedback</objective>
      <steps>
        <step>Mark PHASE 4 in_progress</step>
        <step>
          **User Decision** (AskUserQuestion):
          1. Fix critical + high [RECOMMENDED]
          2. Fix critical only
          3. Accept as-is
        </step>
        <step>If fixing: Launch `agentdev:developer` with consolidated feedback</step>
        <step>Optional: Re-review (max 2 iterations)</step>
        <step>Mark PHASE 4 completed</step>
      </steps>
      <quality_gate>Issues fixed OR user accepted</quality_gate>
    </phase>

    <phase number="5" name="Finalization">
      <objective>Generate report and complete handoff</objective>
      <steps>
        <step>Mark PHASE 5 in_progress</step>
        <step>Create ai-docs/agent-development-report-{name}.md</step>
        <step>Show git status</step>
        <step>Present final summary</step>
        <step>
          **User Satisfaction** (AskUserQuestion):
          - Satisfied → Complete
          - Adjustments needed → PHASE 4
        </step>
        <step>Mark ALL tasks completed</step>
      </steps>
      <quality_gate>User satisfied, report generated</quality_gate>
    </phase>
  </phases>
</orchestration>

<error_recovery>
  <strategy name="Claudish Failure">
    1. Check OPENROUTER_API_KEY set
    2. Check model ID valid
    3. Offer to skip external reviews
  </strategy>

  <strategy name="Review Disagreement">
    1. Highlight divergent feedback
    2. Recommend conservative approach
    3. Let user decide on conflicts
  </strategy>

  <strategy name="Iteration Limit">
    After 2 loops: force user decision (accept or abort)
  </strategy>
</error_recovery>

<recommended_models>
  **Budget**:
  - google/gemini-2.5-flash [$0.05-0.15]
  - deepseek/deepseek-chat [$0.05-0.15]

  **Default** (2 models):
  - x-ai/grok-code-fast-1 [$0.10-0.20]
  - google/gemini-2.5-flash [$0.05-0.15]

  **Comprehensive** (4 models):
  - x-ai/grok-code-fast-1
  - google/gemini-2.5-flash
  - google/gemini-2.5-pro
  - deepseek/deepseek-chat
</recommended_models>

<examples>
  <example name="New Review Agent">
    <command>/develop Create agent that reviews GraphQL schemas</command>
    <execution>
      PHASE 0: Init, Claudish available
      PHASE 1: architect designs review agent
      PHASE 1.5: Grok + Gemini review plan (parallel)
      PHASE 1.6: architect revises based on feedback
      PHASE 2: developer creates .claude/agents/graphql-reviewer.md
      PHASE 3: Local + Grok + Gemini review (parallel) → PASS
      PHASE 4: User accepts
      PHASE 5: Report generated
    </execution>
  </example>

  <example name="Orchestrator Command">
    <command>/develop Create /deploy-aws for ECS deployment</command>
    <execution>
      PHASE 0: Init
      PHASE 1: architect designs 6-phase command
      PHASE 1.5: External reviews suggest smoke tests
      PHASE 1.6: architect adds smoke test phase
      PHASE 2: developer creates command
      PHASE 3: Reviews find missing rollback → CONDITIONAL
      PHASE 4: developer fixes, re-review → PASS
      PHASE 5: Production-ready command delivered
    </execution>
  </example>
</examples>

<communication>
  <final_message>
## Development Complete

**Agent**: {name}
**Location**: {path}
**Type**: {type}

**Validation**:
- Plan review: {count} models (parallel)
- Implementation review: {count} models (parallel)
- Status: APPROVED

**Quality**:
- Critical: 0
- High: {count} (fixed)

**Report**: ai-docs/agent-development-report-{name}.md

Ready to use!
  </final_message>
</communication>

<success_criteria>
  - Design plan created and approved
  - Multi-model plan review completed
  - Agent/command implemented
  - Quality review passed
  - User satisfied
  - Report generated
  - All TodoWrite tasks completed
</success_criteria>
