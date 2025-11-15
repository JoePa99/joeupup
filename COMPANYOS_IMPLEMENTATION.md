# CompanyOS Implementation Guide

## Overview
The CompanyOS feature has been successfully implemented. This system uses Perplexity AI to research and generate comprehensive company context that automatically enhances all AI agent interactions.

## What Was Implemented

### 1. Database Layer
- **Migration**: `supabase/migrations/20250114000000_create_company_os_table.sql`
  - Creates `company_os` table with JSONB storage
  - Includes version tracking and metadata
  - RLS policies for security
  - Unique constraint per company

### 2. Backend - Edge Function
- **Function**: `supabase/functions/generate-company-os/index.ts`
  - Uses Perplexity API (sonar-pro model)
  - Implements Senior Strategic Analyst persona
  - Conducts comprehensive web research
  - Returns structured JSON matching CompanyOS schema
  - Marks assumptions with "(Assumed)" suffix
  - Handles both creation and updates

### 3. Type Definitions
- **Types**: `src/types/company-os.ts`
  - Complete TypeScript interfaces for CompanyOS schema
  - Matches the AI Context Pack Generation specification
  - Includes all nested structures (mission/vision, positioning, SWOT, etc.)

### 4. Utility Functions
- **Library**: `src/lib/company-os.ts`
  - `generateCompanyOS()` - Generate new CompanyOS via AI
  - `getCompanyOS()` - Fetch existing CompanyOS
  - `updateCompanyOS()` - Update CompanyOS manually
  - `formatCompanyOSAsContext()` - Format for AI context injection
  - `extractAssumptions()` - Find assumed values
  - `calculateCompleteness()` - Calculate completeness percentage

### 5. UI Components
- **Generator**: `src/components/company-os/CompanyOSGenerator.tsx`
  - Form for company details (name, industry, website, context)
  - AI generation with progress feedback
  - Clear explanation of what will happen

- **Viewer**: `src/components/company-os/CompanyOSViewer.tsx`
  - Beautiful display of CompanyOS data
  - Stats cards (completeness, version, assumptions, last updated)
  - Collapsible sections with icons
  - Color-coded SWOT analysis
  - Assumptions alert

- **Editor**: `src/components/company-os/CompanyOSEditor.tsx`
  - Tabbed interface for editing sections
  - Core Identity, Market Context, and Brand Voice tabs
  - Version increment on save
  - Cancel functionality

### 6. Integration Points
- **Playbook Page**: `src/pages/Playbook.tsx`
  - New "CompanyOS" tab alongside Playbook Sections and Documents
  - Shows generator if no CompanyOS exists
  - Shows viewer with edit button if CompanyOS exists
  - Switches to editor mode when editing

- **AI Agent Context**: `supabase/functions/chat-with-agent/index.ts`
  - Fetches CompanyOS for agent's company
  - Formats as structured markdown context
  - Injects before document search context
  - Optimized for token efficiency (~700-1000 tokens)
  - Instructs AI to align responses with brand voice and values

## Setup Instructions

### Step 1: Apply Database Migration
```bash
# Run the migration to create the company_os table
npx supabase db push

# Or if using local development:
npx supabase migration up
```

### Step 2: Regenerate TypeScript Types
```bash
# Generate updated types from database
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Step 3: Configure Perplexity API Key
1. Get API key from [Perplexity](https://www.perplexity.ai/)
2. Add to Supabase environment:
```bash
npx supabase secrets set PERPLEXITY_API_KEY=your_api_key_here
```

### Step 4: Deploy Edge Function
```bash
npx supabase functions deploy generate-company-os
```

### Step 5: Test the Feature
1. Navigate to Playbook page
2. Click "CompanyOS" tab
3. Fill in company details
4. Click "Generate CompanyOS"
5. Wait 30-60 seconds for AI research
6. Review and edit as needed

## How It Works

### Generation Flow
1. User provides company name (+ optional industry, website, context)
2. Edge function calls Perplexity API with structured prompt
3. Perplexity conducts web research using real-time data
4. AI generates comprehensive CompanyOS JSON
5. Validates against schema
6. Stores in database with version tracking
7. UI displays beautiful formatted view

### AI Context Injection Flow — Deep Dive

The simple "fetch CompanyOS, slap it into the prompt" flow has been fully overhauled. Dynamic prompt injection now follows a
multi-tier retrieval, reranking, and structured prompt assembly pipeline. The goal is to saturate the model with relevant
company knowledge while still responding naturally—no citations or robotic phrasing required.

#### Context Injection Deep Dive: Making `"@business_analyst how do we increase margins"` Brilliant

```
Storage → Retrieval → Prompt → Response
```

Let’s zoom in on that specific query to see how context moves through the system.

#### 🎯 The Query Journey
```
User types → "@business_analyst how do we increase margins"
             ↓
     [Context Engine Activates]
             ↓
     [Multi-tier Knowledge Retrieval]
             ↓
        [Intelligent Reranking]
             ↓
     [Structured Prompt Assembly]
             ↓
       [AI Response Generated]
             ↓
     [Response with Context Summary]
```

#### 📊 Step-by-Step Flow

##### Step 1 — Query Understanding & Expansion
```typescript
// When user sends: "@business_analyst how do we increase margins"
async function processQuery(userMessage: string, agentId: string) {
  // Parse the message
  const query = "how do we increase margins";

  // Expand query semantically (GPT-3.5 turbo, 200ms)
  const expandedQueries = await expandQuery(query);

  return {
    original: "how do we increase margins",
    expanded: [
      "how do we increase margins",
      "improve profit margins",
      "increase profitability",
      "reduce costs increase revenue",
      "margin expansion strategies",
      "pricing optimization profit",
    ]
  };
}
```
We cast a wide semantic net so the retrieval layer never relies on exact keyword matches.

##### Step 2 — Parallel Context Retrieval
```typescript
// All of these happen simultaneously (~800ms total)
async function retrieveContext(agentId: string, queries: string[]) {
  const companyId = await getCompanyId(agentId);

  // Create embedding for primary query
  const queryEmbedding = await embed(queries[0]); // 150ms

  // Fire off 5 parallel searches
  const [
    companyOSResults,
    agentDocResults,
    playbookResults,
    keywordResults,
    structuredDataResults
  ] = await Promise.all([
    // 1️⃣ TIER 1: CompanyOS (always searched, highest priority)
    searchCompanyOS(companyId, queryEmbedding, queries),

    // 2️⃣ TIER 2: Agent-specific docs
    searchAgentDocs(agentId, companyId, queryEmbedding, queries),

    // 3️⃣ TIER 3: Playbooks
    searchPlaybooks(agentId, companyId, queryEmbedding, queries),

    // 4️⃣ HYBRID: Keyword/full-text search
    keywordSearch(companyId, agentId, queries),

    // 5️⃣ STRUCTURED: Financial data (if exists)
    searchStructuredData(companyId, ['margins', 'costs', 'revenue'])
  ]);

  return {
    companyOS: companyOSResults,
    agentDocs: agentDocResults,
    playbooks: playbookResults,
    keywords: keywordResults,
    structured: structuredDataResults
  };
}
```
CompanyOS is always the foundation, but agent documents, playbooks, ad-hoc keyword matches, and structured data all race in
parallel so we don’t miss signal.

##### Step 3 — Retrieval Output Example
For "how do we increase margins" we might get:

```typescript
{
  companyOS: [ /* Pricing Philosophy, Strategic Priorities, Unit Economics */ ],
  agentDocs: [ /* Business Analyst playbook snippets */ ],
  playbooks: [ /* CFO pricing experiments */ ],
  keywords: [ /* Sales team intel */ ],
  structured: { margins_data: { current_gross_margin: 0.68, ... } }
}
```
Each chunk carries source metadata and a relevance score so we can transparently reason about what was pulled in.

##### Step 4 — Intelligent Reranking
```typescript
async function rerankResults(allChunks: Chunk[], query: string) {
  // Use Cohere Rerank API (100ms)
  const reranked = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query: "how do we increase margins",
    documents: allChunks.map(c => c.content),
    topN: 8
  });

  return reranked; // [0.96, 0.94, 0.93, ...]
}
```
We merge all tiers, rerank by exact query relevance, and only keep the top eight chunks.

##### Step 5 — Structured Prompt Assembly
```typescript
function buildPrompt(agent, context, userQuery, conversationHistory) {
  const prompt = `
# YOU ARE: Business Analyst AI

You are Acme Corp's Business Analyst AI. You provide data-driven financial
analysis and strategic recommendations based on company knowledge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR COMPANY CONTEXT (CRITICAL - REFERENCE THIS IN YOUR RESPONSE)

You have deep knowledge of Acme Corp through three tiers of information:

### TIER 1: CompanyOS (Foundation - Always Use This)

**Acme's Pricing Philosophy**
${context.companyOS[0].content}

**2025 Strategic Priorities: Margin Expansion**
${context.companyOS[1].content}

**Current Unit Economics**
${context.companyOS[2].content}

### TIER 2: Your Specialized Knowledge

**Financial Analysis Framework**
${context.agentDocs[0].content}

### TIER 3: Team-Contributed Knowledge

**Q4 2024 Pricing Analysis** (from Sarah, CFO)
${context.playbooks[0].content}

**Field Intelligence** (from Mike, Sales Team)
${context.keywords[0].content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## YOUR TASK

The user asked: "${userQuery}"

Using the context above, provide a comprehensive, data-driven answer that:
1. Directly answers their question with specific, actionable recommendations
2. References specific data points from the context
3. Stays true to Acme's strategy (the CompanyOS context)
4. Prioritizes by impact (highest ROI recommendations first)
5. Speaks naturally about the knowledge

## RESPONSE STRUCTURE

**Executive Summary**
**Analysis**
**Recommendations**
**Expected Impact**

Begin your response:
`;

  return prompt;
}
```
The prompt enforces hierarchy (CompanyOS → agent docs → team intel), instructs the agent to speak like an insider, and locks in
the response structure.

##### Step 6 — AI Response
The system prompt above plus the raw user message is sent to GPT-4 Turbo (or configured model). The end user simply sees a clean
chat reply—rich in internal context, devoid of footnote citations, and optionally capped with a lightweight "Used CompanyOS + 5
sources" indicator.

Sample output:

```
🤖 Business Analyst:

**Executive Summary**
We can expand gross margins from 68% to 75%+ through three lever pulls:
pricing optimization (highest impact), S&M efficiency (biggest cost drain),
and product mix shifts. Based on our 2025 strategy and recent experiments,
prioritizing usage-based pricing could add 8 margin points with minimal risk.

**Analysis**

1. **Pricing Power**: ...
2. **Cost Structure Imbalance**: ...
3. **Proven Success Path**: ...
4. **Sales Discounting Issue**: ...

**Recommendations**
Phase 1 pricing actions → Phase 2 cost optimization → Phase 3 product mix.

**Expected Impact**
Conservative: +15 pts (68% → 83%) = $18M EBITDA
Aggressive: +20 pts (68% → 88%) = $24M EBITDA

Should I model scenarios in more detail, or build the implementation roadmap?
```

#### 💬 What The User Sees
```
┌─────────────────────────────────────────────────────────┐
│  Business Analyst                             [●] Online │
├─────────────────────────────────────────────────────────┤
│  👤 You (2:34 PM)                                       │
│  how do we increase margins                             │
│                                                         │
│  🤖 Business Analyst (2:35 PM)                          │
│  [Full brilliant response]                              │
│  Should I model out the financial scenarios in more     │
│  detail, or help you build the implementation roadmap?  │
├─────────────────────────────────────────────────────────┤
│  [Type your message...]                          [Send] │
└─────────────────────────────────────────────────────────┘
```

#### Optional Enhancements
- **Context Transparency**: show a minimal footer such as `✓ Used CompanyOS + 5 other sources`.
- **Conversation Awareness**: merge context from the last 3 turns with the newly retrieved set.
- **Context Weighting**: adjust CompanyOS/agent/playbook ratios based on query intent (pricing vs. support, etc.).
- **Small KB Optimization**: when CompanyOS is <30k tokens, skip chunking and stream the whole doc.
- **Quality Metrics Dashboard**: track retrieval latency, chunk counts, usage rates per tier, confidence, and follow-up rate.

```
┌─────────────────────────────────────────────────────────┐
│  🤖 Business Analyst (2:35 PM)                          │
│  [Full response]                                        │
│  ───────────────────────────────────────────────────    │
│  ✓ Used CompanyOS + 5 other sources                     │
└─────────────────────────────────────────────────────────┘
```

#### 🎯 Why This Response Is Brilliant
1. **Context Saturation** – references real numbers (23%, $14M, 8 pts) and real people (Sarah, Mike).
2. **Strategic Alignment** – mirrors "compete on value" and 2025 margin expansion focus.
3. **Actionability** – phased plan, quantified impact, clear next steps.
4. **Natural Language** – talks like an insider: “Our pricing philosophy shows…”.

#### 🔬 The Technical Secret Sauce
```typescript
// ❌ BASIC RAG (What most tools do)
async function basicRAG(query: string) {
  const embedding = await embed(query);
  const chunks = await vectorSearch(embedding, { limit: 5 });
  return `Context: ${chunks.join('\n\n')}\n\nQuestion: ${query}`;
}

// ✅ OUR APPROACH (Context King)
async function contextKingRAG(query: string, agentId: string) {
  const expanded = await expandQuery(query);
  const context = await retrieveContext(agentId, expanded);
  const reranked = await rerank(context, query);
  const structured = structureByTier(reranked);
  return buildPrompt(agentId, structured, query);
}
```

#### 🎨 Advanced Context Features

**Feature 1 — Context Window Optimization**
```typescript
async function optimizeContext(companyId: string) {
  const companyOS = await getCompanyOS(companyId);
  const estimatedTokens = companyOS.raw_content.length / 4;

  if (estimatedTokens < 30000) {
    return {
      strategy: 'full_document',
      content: companyOS.raw_content,
      reason: 'Small enough to fit in context window'
    };
  }

  return {
    strategy: 'hybrid_search',
    chunks: await smartChunk(companyOS.raw_content)
  };
}
```

**Feature 2 — Query-Specific Context Weighting**
```typescript
function adjustContextWeights(query: string) {
  if (/pricing|cost|margin|revenue/i.test(query)) {
    return { companyOS: 0.5, agentDocs: 0.3, playbooks: 0.2 };
  }
  if (/customer|support|ticket/i.test(query)) {
    return { companyOS: 0.3, agentDocs: 0.3, playbooks: 0.4 };
  }
  return { companyOS: 0.4, agentDocs: 0.3, playbooks: 0.3 };
}
```

**Feature 3 — Conversation-Aware Context**
```typescript
async function getConversationAwareContext(query: string, history: Message[]) {
  const fresh = await retrieveContext(query);
  const previous = history.slice(-3).flatMap(msg => msg.context_used);
  return deduplicateContext([...fresh, ...previous]);
}
```

### Applying Dynamic Context Injection to Every Assistant

The deep dive above focused on the Business Analyst persona, but the entire retrieval → rerank → prompt assembly pipeline now powers **all** assistants automatically. The orchestration layer keeps persona-specific logic separate from the shared context stack so new assistants inherit the exact same dynamic behavior on day one.

#### 1. Shared Retrieval Service

- `retrieveContext(agentId, expandedQueries)` already accepts an `agentId` and resolves the owning company via `getCompanyId(agentId)`.
- Because every assistant record includes its `company_id`, running the function for Support, Sales, CS, or Marketing agents uses the same multi-tier fetch and Cohere rerank path.
- The service returns a normalized payload, so downstream prompt builders don’t need to know whether a chunk came from CompanyOS, agent docs, or playbooks.

#### 2. Assistant-Aware Prompt Builder

Add a helper that hydrates persona instructions (tone, structure, capabilities) while dropping in the shared context hierarchy:

```typescript
function buildAssistantPrompt(agentProfile: AgentProfile, context: TieredContext, userQuery: string, history: Message[]) {
  return `# YOU ARE: ${agentProfile.display_name}

${agentProfile.persona_instructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## COMPANY CONTEXT (Always reference this)
${renderTier('CompanyOS', context.companyOS)}
${renderTier(agentProfile.specialty_label, context.agentDocs)}
${renderTier('Recent Team Intelligence', [...context.playbooks, ...context.keywords])}

## TASK
The user asked: "${userQuery}"
${agentProfile.response_structure}
`;}
```

Each assistant stores its `persona_instructions` and `response_structure` (e.g., Support agents emphasize troubleshooting steps, Sales agents highlight objection handling). The rendered tier blocks stay identical regardless of persona, guaranteeing that CompanyOS content is always injected ahead of secondary documents.

#### 3. Default Profile Templates for Every Assistant Type

| Assistant Type        | Persona Highlights                                                                 | Recommended Response Frame                     |
|-----------------------|--------------------------------------------------------------------------------------|------------------------------------------------|
| Business Analyst      | Data-first, financial modeling, impact quantification                              | Executive Summary → Analysis → Recommendations |
| Sales Strategist      | Value selling, objection handling, pricing guardrails                              | Deal Context → Talking Points → Next Actions   |
| Customer Support Lead | Empathetic troubleshooting, policy recall, escalation criteria                     | Diagnosis → Resolution Steps → Follow-up       |
| Product Specialist    | Feature deep dives, roadmap references, integration guidance                       | Feature Overview → Evidence → Action Plan      |
| Marketing Partner     | Campaign strategy, ICP messaging, asset requests                                   | Audience Insight → Campaign Ideas → Metrics    |

Creating a new assistant simply means choosing the proper template (or customizing one) and pointing it at the same context pipeline—no bespoke RAG work required.

#### 4. Wiring It Up in `chat-with-agent`

```typescript
export async function handleChat(agentId: string, userMessage: string, history: Message[]) {
  const agent = await getAgent(agentId); // persona + type
  const expanded = await expandQuery(parseQuery(userMessage));
  const context = await retrieveContext(agentId, expanded);
  const reranked = rerankResults(flattenContext(context), expanded.original);
  const structured = structureByTier(reranked, agent.type);
  const prompt = buildAssistantPrompt(agent, structured, userMessage, history);
  return callChatModel(prompt, userMessage, history);
}
```

Every assistant now routes through this method, so improvements to query expansion, retrieval, reranking, or prompt formatting land everywhere simultaneously.

#### 5. Assistant-Specific Context Weighting

Layer persona rules on top of the query-based weights for even tighter control:

```typescript
const personaAdjustments: Record<AgentType, ContextWeights> = {
  analyst: { companyOS: 0.5, agentDocs: 0.3, playbooks: 0.2 },
  support: { companyOS: 0.35, agentDocs: 0.25, playbooks: 0.4 },
  sales:   { companyOS: 0.4, agentDocs: 0.2, playbooks: 0.4 },
  marketing:{ companyOS: 0.45, agentDocs: 0.35, playbooks: 0.2 },
  product: { companyOS: 0.4, agentDocs: 0.4, playbooks: 0.2 },
};

function getWeights(agentType: AgentType, query: string) {
  const personaWeights = personaAdjustments[agentType];
  const queryWeights = adjustContextWeights(query);
  return normalizeWeights(mergeWeights(personaWeights, queryWeights));
}
```

This guarantees that, for example, Customer Support assistants lean harder on recent playbook snippets while still grounding every reply in CompanyOS strategy.

#### 6. Operational Checklist When Adding/Updating Assistants

1. **Create/Update Agent Profile** – fill in persona copy, response template, default tone.
2. **Attach Knowledge Sources** – upload agent-specific documents or link existing playbooks.
3. **Verify Retrieval Coverage** – run `retrieveContext` in staging using representative test queries.
4. **Review Prompt Rendering** – inspect the generated prompt to ensure tiers are present and persona language reads correctly.
5. **Smoke Test Chats** – send multiple example queries (pricing, support, roadmap) and confirm the response references CompanyOS data.

Once this checklist is complete, the assistant is automatically on the same dynamic context stack as every other persona—no duplicated implementation steps.

#### 📊 Measuring Context Quality
```typescript
interface ContextQualityMetrics {
  avgRetrievalTime: number;        // Target < 1000ms
  avgChunksRetrieved: number;      // Target 5-8
  avgRelevanceScore: number;       // Target > 0.85
  companyOSUsageRate: number;      // Target > 90%
  agentDocsUsageRate: number;      // Target > 70%
  playbooksUsageRate: number;      // Target > 50%
  lowConfidenceQueries: Query[];
  missingTopics: string[];
  responseRating: number;
  followUpQuestionRate: number;
}
```

Simple dashboard idea:
```
┌─────────────────────────────────────────────────────────┐
│  🔒 Context Performance - Acme Corp                     │
├─────────────────────────────────────────────────────────┤
│  Average response quality:  87% ████████▓░              │
│  CompanyOS usage:          94% █████████▓               │
│  Average retrieval time:    0.8s                        │
│  ⚠️ Areas to Improve: return policy questions (62%)     │
└─────────────────────────────────────────────────────────┘
```

#### 🚀 Implementation Checklist
- **Database**: tiered storage (CompanyOS, agent docs, playbooks), pgvector indexes, pg_trgm search, metadata filters.
- **Retrieval**: query expansion, parallel multi-tier search, hybrid vector+keyword, reranking, deduplication.
- **Prompt**: hierarchical context sections, natural-language guidance, conversation history integration.
- **Response**: no citations, optional context indicator, backend confidence scoring, quality monitoring hooks.

### Context Structure
The structured prompt still leans on the same CompanyOS pillars:
- **Core Identity**: Overview, mission, vision, values, right to win
- **Market Position**: Target audience, unique benefit, ICP, competitors
- **Brand Voice**: Purpose, transformation, voice style, do's/don'ts, beliefs
- **Customer Pain Points**: Top 3 pain points
- **Value Propositions**: Per customer segment

## Benefits

### For End Users
- More contextually-aware AI responses
- Brand-aligned tone and language
- Better understanding of company values and positioning
- Relevant recommendations based on customer pain points

### For Admins
- One-time setup with automatic context injection
- Visual editor for refinement
- Version tracking for changes
- Assumptions clearly marked for review

### For AI Agents
- Rich company context without manual configuration
- Consistent brand voice across all agents
- Access to strategic positioning and values
- Customer pain points for better problem-solving

## Schema Coverage

The CompanyOS includes all required sections from the specification:

### Core Identity & Strategic Foundation
- ✅ Company Overview
- ✅ Mission & Vision
- ✅ Core Values (3-5)
- ✅ Core Competencies (3-5)
- ✅ Positioning Statement (4 parts)
- ✅ Business Model (revenue, pricing, distribution)
- ✅ Key Performance Indicators (3)
- ✅ Right to Win
- ✅ SWOT Analysis (3 each)

### Customer & Market Context
- ✅ Ideal Customer Profile (traits, demographics, persona)
- ✅ Customer Segments (with descriptions)
- ✅ Customer Journey (pain points, opportunities)
- ✅ Market Analysis (category, competitors)
- ✅ Value Propositions (per segment)

### Brand Voice & Expression
- ✅ Brand Purpose
- ✅ The Hot Take
- ✅ Powerful Beliefs (5)
- ✅ Transformation (from/to)
- ✅ Brand Voice Do's & Don'ts
- ✅ Celebrity Analogue
- ✅ Content Strategy (pillars, imperatives)

## Future Enhancements

Potential improvements:
1. **Onboarding Integration**: Add CompanyOS generation to company onboarding
2. **Scheduled Updates**: Quarterly regeneration to keep data current
3. **Analytics**: Track which sections are most referenced by AI
4. **Export**: Download as PDF or markdown
5. **Comparison**: Compare versions to see changes
6. **Templates**: Industry-specific templates for faster setup
7. **Collaboration**: Multi-user editing with comments
8. **API**: Expose CompanyOS via API for other integrations

## Troubleshooting

### CompanyOS Not Generating
- Check Perplexity API key is set correctly
- Verify edge function is deployed
- Check browser console for errors
- Ensure company name is provided

### AI Not Using Context
- Verify company_os table exists
- Check agent has company_id set
- Review chat-with-agent logs for CompanyOS fetch
- Ensure os_data is valid JSON

### Type Errors
- Run type generation after migration
- Clear TypeScript cache if needed
- Restart IDE/dev server

## Support

For issues or questions:
1. Check migration was applied successfully
2. Verify Perplexity API key is configured
3. Review edge function logs
4. Check browser console for frontend errors

---

**Implementation Date**: January 14, 2025
**Version**: 1.0
**Status**: Complete ✅

