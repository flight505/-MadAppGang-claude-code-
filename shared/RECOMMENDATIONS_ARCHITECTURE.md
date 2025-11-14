# AI Model Recommendations - Complete Architecture

**Version:** 2.0.0
**Updated:** 2025-11-14
**Breaking Changes:** Simplified from complex XML to Quick Reference approach + Tiered Pricing handling

---

## Overview

This document describes the complete architecture for maintaining and distributing AI model recommendations across the Claude Code plugin ecosystem.

---

## File Structure

### Core Files

| File | Purpose | Audience | Format |
|------|---------|----------|--------|
| `recommended-models.md` | Comprehensive guide with Quick Reference | AI agents + Humans | Markdown |
| `recommended-models.xml` | Minimal quick reference | External tools | XML |
| `QUICK_REFERENCE_SPEC.md` | Format specification for Quick Reference | Maintainers | Markdown |
| `TIERED_PRICING_SPEC.md` | Tiered pricing handling rules | Model scraper agent | Markdown |
| `XML_FORMAT_GUIDE.md` | Guide for both file formats | Developers | Markdown |
| `RECOMMENDATIONS_ARCHITECTURE.md` | This file - complete system overview | Architects | Markdown |

### Distribution

Files are synced to all plugins via:
```bash
bun run scripts/sync-shared.ts
```

**Locations:**
- Source: `shared/recommended-models.{md,xml}`
- Synced to: `plugins/{frontend,bun,code-analysis}/recommended-models.{md,xml}`

---

## Architecture Principles

### 1. Single Source of Truth

**Primary file:** `shared/recommended-models.md`

All updates happen here first, then:
1. Update `recommended-models.xml` to match
2. Sync to all plugins via script
3. Git commit with version bump

### 2. Quick Reference First

**Problem:** LLMs don't need complex XML parsing - they read markdown natively.

**Solution:** Add Quick Reference section at top of markdown file:
- 6-9 recommended models
- One-line format: `` `slug` - Description, $X.XX/1M, XXK ⭐ ``
- Grouped by category (Coding, Reasoning, Vision, Budget)
- Easy to scan and extract

**Example:**
```markdown
## Quick Reference - Model IDs Only

**Coding (Fast):**
- `x-ai/grok-code-fast-1` - Ultra-fast coding, $0.85/1M, 256K ⭐
- `google/gemini-2.5-flash` - Massive context, $0.19/1M, 1M ⭐

**Reasoning (Architecture):**
- `z-ai/glm-4.6` - Best for planning, $0.75/1M, 128K ⭐
```

### 3. Tiered Pricing Handling

**Problem:** Some models have tiered pricing where cost increases dramatically at higher context.

**Example: Claude Sonnet 4.5**
- 0-200K tokens: $3 input, $15 output → avg **$9/1M** ✅
- 200K-1M tokens: $30 input, $150 output → avg **$90/1M** ❌ (10x more!)

**Solution:** Always represent models at their CHEAPEST tier:
- Price: Use lowest tier average ($9/1M, not $49.50/1M averaged)
- Context: Use tier maximum (200K, not 1M full capacity)
- Metadata: Add `tiered: true`, asterisk in price `$9/1M*`
- Warning: Include ⚠️ note about expensive higher tiers

**Rationale:**
- Accurate expectations (no budget surprises)
- Comparable pricing (apples-to-apples)
- Honest representation (users know real costs)

See `TIERED_PRICING_SPEC.md` for complete specification.

### 4. Minimal XML for External Tools

**XML is optional** - most AI agents should use markdown Quick Reference.

**XML Format (simplified):**
```xml
<models version="1.1.1" updated="2025-11-14">
  <coding>
    <model slug="x-ai/grok-code-fast-1" price="0.85" context="256K" recommended="true" />
    <model slug="google/gemini-2.5-flash" price="0.19" context="1M" recommended="true" tiered="true" />
  </coding>
</models>
```

**Use case:** External tools requiring XPath queries or language-agnostic parsing.

---

## Update Workflow

### Automated Updates (Recommended)

**Command:** `/update-models`

**Process:**
1. **PHASE 0:** Validate prerequisites (model-scraper agent, sync script)
2. **PHASE 1:** Scrape OpenRouter rankings via model-scraper agent
   - Extract top 9-12 models
   - **Apply tiered pricing detection** (cheapest tier selection)
   - Filter: Remove Anthropic, deduplicate providers, balance categories
3. **PHASE 2:** User approval gate (show filtered models, allow modification)
4. **PHASE 3:** Update `shared/recommended-models.md` via model-scraper agent
   - Update Quick Reference section
   - Update detailed sections
   - Increment version number
5. **PHASE 4:** Sync to all plugins via `bun run scripts/sync-shared.ts`

**Key Feature:** Tiered pricing detection happens automatically in PHASE 1.

### Manual Updates

**Step 1:** Edit source file
```bash
vim shared/recommended-models.md
```

**Step 2:** Update Quick Reference section
- Follow format in `QUICK_REFERENCE_SPEC.md`
- Add asterisk for tiered pricing models
- Keep 6-9 models total

**Step 3:** Update XML to match
```bash
vim shared/recommended-models.xml
```

**Step 4:** Sync to plugins
```bash
bun run scripts/sync-shared.ts
```

**Step 5:** Commit changes
```bash
git add shared/recommended-models.{md,xml} plugins/*/recommended-models.{md,xml}
git commit -m "chore: update model recommendations to v1.1.2"
```

---

## Tiered Pricing Implementation

### Detection (Model Scraper Agent)

**File:** `.claude/agents/model-scraper.md`

**Logic:**
```typescript
// When scraping OpenRouter model details
if (Array.isArray(model.pricing) && model.pricing.length > 1) {
  // Tiered pricing detected!

  const tiers = model.pricing.map(tier => ({
    range: tier.range,
    avgPrice: (tier.input + tier.output) / 2,
    maxTokens: parseRange(tier.range).max
  }));

  // Select cheapest tier
  const cheapest = tiers.sort((a, b) => a.avgPrice - b.avgPrice)[0];

  // Record with tier-specific data
  return {
    slug: model.id,
    price: cheapest.avgPrice,        // NOT averaged across tiers!
    context: cheapest.maxTokens,     // Tier max, NOT full capacity!
    tiered: true,
    fullContext: model.context_length  // Keep for reference
  };
}
```

### Recording (Quick Reference)

**Markdown:**
```markdown
- `anthropic/claude-sonnet-4-5` - Premium coding, $9.00/1M*, 200K ⭐

*Tiered pricing - price shown is for 0-200K tokens.
```

**XML:**
```xml
<model slug="anthropic/claude-sonnet-4-5" price="9.00" context="200K" tiered="true" />
```

### Detailed Section (Markdown)

**Add pricing warning:**
```markdown
### anthropic/claude-sonnet-4-5 (⭐ RECOMMENDED)

- **Context Window:** 200,000 tokens (cheapest tier)
- **Full Context:** 1,000,000 tokens (tiered pricing)
- **Pricing:** $3/1M input, $15/1M output (0-200K tokens)
- **Pricing Note:** ⚠️ **Tiered pricing** - $30/$150 per 1M beyond 200K tokens (10x more expensive)

**Trade-offs:**
- ⚠️ **Expensive beyond 200K** - Stay within first tier for cost efficiency
- 10x price increase beyond 200K tokens

**When to Use:**
- ✅ **Context < 200K** (avoid expensive tier)

**Avoid For:**
- ❌ **Large context needs** (>200K) - use Gemini Flash (1M at $0.19/1M flat)
```

---

## Integration Examples

### Example 1: AI Agent Extracts Models

**Markdown Approach (Recommended):**
```typescript
const md = await readFile('shared/recommended-models.md');

// Extract Quick Reference section
const quickRef = md.match(/## Quick Reference.*?\n---/s)[0];

// Extract coding models
const codingSection = quickRef.match(/\*\*Coding \(Fast\):\*\*(.*?)\*\*/s)[1];
const models = [...codingSection.matchAll(/`([^`]+)`/g)].map(m => m[1]);

console.log(models);
// ["x-ai/grok-code-fast-1", "google/gemini-2.5-flash", "deepseek/deepseek-v3-0324"]
```

**XML Approach (External Tools):**
```python
import xml.etree.ElementTree as ET

tree = ET.parse('shared/recommended-models.xml')
coding_models = tree.findall('.//coding/model[@recommended="true"]')

for model in coding_models:
    slug = model.get('slug')
    price = model.get('price')
    tiered = model.get('tiered') == 'true'

    print(f"{slug}: ${price}/1M {'(tiered)' if tiered else ''}")
```

### Example 2: Multi-Model Plan Review

**In `/implement` command:**
```markdown
**Step 1:** Read model recommendations
Read shared/recommended-models.md

**Step 2:** Extract reasoning models from Quick Reference
Extract all models from "Reasoning (Architecture)" section

**Step 3:** Present to user
"Select models for architecture plan review:
• z-ai/glm-4.6 - Best for planning, $0.75/1M, 128K ⭐
• anthropic/claude-sonnet-4-5 - Premium reasoning, $9.00/1M*, 200K ⭐ (tiered)
• Custom model ID"
```

---

## Maintenance Checklist

### When Adding New Model

- [ ] Check if tiered pricing exists (OpenRouter model page)
- [ ] If tiered: select cheapest tier, record tier max as context
- [ ] Add to Quick Reference (top of markdown file)
- [ ] Add to appropriate category in detailed section
- [ ] Add to XML file
- [ ] Update version number (patch bump)
- [ ] Update "Last Updated" date
- [ ] Sync to plugins (`bun run scripts/sync-shared.ts`)
- [ ] Test extraction with sample prompt

### When Removing Model

- [ ] Remove from Quick Reference
- [ ] Remove from detailed section
- [ ] Remove from XML file
- [ ] Update version number (minor bump)
- [ ] Sync to plugins
- [ ] Check commands/agents for hardcoded references

### When Updating Pricing

- [ ] Verify pricing on OpenRouter
- [ ] Check if tiering changed
- [ ] If tiered: recalculate cheapest tier
- [ ] Update Quick Reference
- [ ] Update detailed section
- [ ] Update XML file
- [ ] Update version number (patch bump)
- [ ] Update "Last Updated" date
- [ ] Sync to plugins

---

## Version History

### v2.0.0 (2025-11-14) - Breaking Changes

**Added:**
- Quick Reference section in markdown
- Tiered pricing handling specification
- Minimal XML format (37 lines vs 215)
- QUICK_REFERENCE_SPEC.md
- TIERED_PRICING_SPEC.md
- This architecture document

**Changed:**
- XML format simplified (attributes-only, no nested elements)
- Markdown is now primary file (was equal to XML)
- Context windows reflect cheapest tier (not full capacity)
- Prices reflect cheapest tier (not averaged across tiers)

**Removed:**
- Complex XML schema with nested elements
- Verbose model metadata in XML

**Migration:**
- AI agents: Use markdown Quick Reference instead of XML parsing
- External tools: Update XPath queries for new XML schema
- Commands: Reference TIERED_PRICING_SPEC.md for handling rules

### v1.1.1 (2025-11-14) - Previous Version

- Comprehensive XML with detailed metadata
- Markdown documentation for humans
- No Quick Reference section
- No tiered pricing handling

---

## Questions and Support

**For architecture questions:**
- See individual spec files (QUICK_REFERENCE_SPEC.md, TIERED_PRICING_SPEC.md)
- Check XML_FORMAT_GUIDE.md for format details

**For technical issues:**
- Contact: Jack Rudenko (i@madappgang.com)
- Repository: https://github.com/MadAppGang/claude-code

**To suggest improvements:**
- Open issue with proposed changes
- Include use case and rationale

---

**Maintained By:** MadAppGang Claude Code Team
**Repository:** https://github.com/MadAppGang/claude-code
**License:** MIT
