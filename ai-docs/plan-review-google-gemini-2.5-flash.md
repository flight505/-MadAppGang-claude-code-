## Command Design Review: `/update-models`

### 1. Role Definition

*   **CRITICAL:** The "Identity" needs to be more action-oriented. "Model Recommendation Update Orchestrator" is descriptive but less active.
    *   **Recommendation:** Change "Identity: Model Recommendation Update Orchestrator" to **"Identity: Model Recommendation Updater"** or **"OpenRouter Model Sync Orchestrator"**.
*   **LOW:** "Expertise" is strong. Consider adding "Markdown content generation/management" as an explicit expertise since it involves updating `recommended-models.md` through delegation.
    *   **Recommendation:** Add "Markdown content generation/management" to the Expertise list.
*   **MEDIUM:** "Mission" is clear and appropriate. No changes needed.

### 2. Instruction Clarity

*   **CRITICAL:** **Constrain Filtering Logic with `model-scraper` Capabilities**: In "PHASE 1: Scrape Trending Models" (lines 127-140), the prompt to `model-scraper` asks for filtering by "trending programming models", "fast coding models", etc., implying `model-scraper` is capable of this categorization. If `model-scraper` is solely for OpenRouter scraping, this constraint is misdirected. The orchestrator's PHASE 2 filtering implies it performs this. This is a critical discrepancy.
    *   **Recommendation:**
        1.  **Clarify `model-scraper`'s role:** If`model-scraper` *only* scrapes raw data, remove semantic hints ("Focus on: Fast coding models", etc.) from PHASE 1's prompt to it.
        2.  **Explicitly place category assignment:** Ensure the category assignment logic is in PHASE 2, performed by the orchestrator (or a new dedicated agent the orchestrator delegates to).
*   **HIGH:** **Clarify "top-ranked per provider"**: In "PHASE 2: Filter and Deduplicate" (lines 165-167) and "Deduplication Strategy" (line 206), it states "Keep ONLY the top-ranked model (earliest in list)". It's important to specify _how_ "rank" is determined.
    *   **Recommendation:** Explicitly state that "rank" refers to OpenRouter's inherent sorting order as scraped by `model-scraper`.
*   **MEDIUM:** **User Approval Gate Modification Support**: In "PHASE 3: User Approval" (line 248), for "Modify list", it states "Ask user which models to add/remove". This needs more concrete guidance for parsing unstructured user input.
    *   **Recommendation:** Define a structured input format for user modifications (e.g., "add `provider/model-slug`, category, pricing, context" or reference by a presented number/ID). This simplifies parsing for the orchestrator.
*   **MEDIUM:** **Category Balance Heuristics**: In "PHASE 2: Filter and Deduplicate" (lines 170-173), "Category Balance" implies ensuring at least 2 models per category, but the pseudocode (lines 209-214) is a placeholder and doesn't explicitly show how a second model would be re-added after deduplication.
    *   **Recommendation:** Detail the re-inclusion logic for category balancing. This might involve relaxing the deduplication rule for under-represented categories *after* initial deduplication, potentially by re-evaluating initially removed models that satisfy the category need. The pseudocode needs to reflect this more complex logic.

### 3. Orchestration Pattern

*   **CRITICAL:** The orchestrator's core design principle is delegation. However, the current plan has the orchestrator performing complex data manipulation (filtering, deduplication, category balancing) in PHASE 2 (lines 155-183) directly.
    *   **Recommendation:** Create a temporary "model-filter" agent (or significantly enhance `model-scraper` to include filtering logic) and delegate the filtering and deduplication to it. The orchestrator should only _coordinate_ the filtering, not _perform_ it. This keeps the orchestrator lean and focused on workflow management.
*   **HIGH:** **Clarity of `model-scraper` output and input**: PHASE 1 (lines 142-143) describes `model-scraper` updating `shared/recommended-models.md`, and then the orchestrator reading that file. PHASE 4 (lines 308-325) also has `model-scraper` updating the same file. This implies `model-scraper` is responsible for *writing* the Markdown content, not just providing raw data. This should be a clearly defined capability of `model-scraper`.
    *   **Recommendation:** Explicitly detail in `model-scraper`'s design how it updates the `recommended-models.md` markdown file, including preserving structure and handling specific sections for updates. Ensure `model-scraper` can accept the full list of approved models as input for PHASE 4.
*   **MEDIUM:** **PHASE 0 Prerequisites**: "Check if model-scraper agent available" (line 115) by "grep agents directory" is not robust.
    *   **Recommendation:** Replace the `grep` check with a more reliable agent availability mechanism, such as attempting to `Task` the `model-scraper` agent with a simple diagnostic command and handling potential errors.

### 4. Filtering Logic

*   **CRITICAL:** The core filtering logic (Anthropic removal, provider deduplication, category balancing) is currently performed by the orchestrator. This violates the orchestrator pattern. (See "Orchestration Pattern" feedback above).
*   **HIGH:** **Duplicate Providers & Category Balance Interaction**: The logic "Keep ONLY the top-ranked model (earliest in list)" (line 166) for provider deduplication is sound for diversity. However, the subsequent "Category Balance" (lines 170-173) implies potentially re-introducing models from deduplicated providers to balance categories, which creates a complex interaction.
    *   **Recommendation:** Refine the prioritization of these two rules. A more robust approach might be:
        1.  Initial filtering (Anthropic removal).
        2.  Provider deduplication (keeping the top-ranked OR, if designed to, a second model only if it addresses a critical category imbalance).
        3.  Category balancing logic that intelligently re-incorporates *already available* models (e.g., initially removed due to deduplication) if needed, without violating other rules.

### 5. User Approval Gate

*   **HIGH:** **User Modification Ambiguity**: This is reiterated from Instruction Clarity. The lack of structured input for "Modify list" can lead to parsing errors and poor user experience.
    *   **Recommendation:** Implement clear, structured prompts for user modifications (e.g., "Please provide additions in the format `add: provider/model-slug, category, pricing, context` and removals as `remove: provider/model-slug`").

### 6. Error Recovery

*   **HIGH:** **Consistency in Restore/Rollback**: The use of backup/restore through copying files (lines 306-307, 329, 396, 706) is a good safety measure. However, ensure that the `cp` command is always used with absolute paths to prevent issues with current working directory changes.
    *   **Recommendation:** Explicitly ensure all `cp` commands for backup/restore use absolute file paths.
*   **MEDIUM:** **Scraping Failure (PHASE 1)**: If `model-scraper` fails, the orchestrator "offer[s] to use existing models" (line 150), implying it might proceed with old data. This could be confusing in an "update" flow.
    *   **Recommendation:** Clarify the exact behavior for "using existing models." Does it mean to revert to the previously recommended list, or to use the *partially* scraped models as a base, or to abandon the update entirely? Define this explicitly.

### 7. Completeness

*   **HIGH:** **`model-scraper` Input/Output contract**: The design relies heavily on the `model-scraper` agent. Its expected input and output, and specifically how it handles updating the `recommended-models.md` file (including markdown structure, versioning, date updates), must be explicitly defined in its own design to ensure a seamless integration.
    *   **Recommendation:** Ensure `model-scraper`'s design unequivocally states its capabilities regarding markdown file updates and data formatting.
*   **LOW:** The overall design plan is remarkably complete, covering a wide range of considerations, from happy paths to edge cases and future enhancements.

### 8. Tool Selection

*   **CRITICAL:** The instruction "MUST NOT use Write or Edit tools directly" (line 37) is appropriate for an orchestrator. However, the orchestrator is proposed to execute the filtering and selection logic in PHASE 2. If this logic produces a new list of models, the orchestrator then needs a way to update `shared/recommended-models.md` with this _final_ approved list (PHASE 4). The delegation rules state "File updates → model-scraper agent" (line 104), implying `model-scraper` should handle this. This reinforces the need for the orchestrator to delegate the filtering logic first AND then delegate the *final* file write with the filtered data.
    *   **Recommendation:** Realign the workflow so that the orchestrator's filtering logic from PHASE 2 is delegated. The orchestrator should provide the scraped data to a filtering agent (or an enhanced `model-scraper`), receive the filtered data back, and then send the *final approved filtered data* to `model-scraper` for the actual update of `shared/recommended-models.md` in PHASE 4. The tool selection list should remain as is for the orchestrator, but the orchestration logic needs to strictly adhere to it.

---

This is a comprehensive plan. Addressing these feedback points, especially regarding the strict adherence to the orchestrator pattern and clarifying `model-scraper`'s precise responsibilities, will significantly improve the robustness and maintainability of the `/update-models` command.