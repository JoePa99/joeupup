# Context-First Rebuild Plan

## Objectives
- Remove complex onboarding; focus on fast registration and clear admin setup.
- Make context delivery the core value: company OS + assistant-specific + general knowledge bases.
- Provide assistants with model choice, image generation, web search, and deep research tools.
- Keep existing backend/frontend foundations and Slack-like collaboration UI.

## Simplified User Flow
1. **Signup/Onboarding**
   - Minimal registration (email + password or SSO).
   - Single welcome screen that immediately prompts the admin to upload Company OS.
2. **Admin Console**
   - Upload/replace **Company OS** (highest priority source for all assistants).
   - Add **General Knowledge Base** (shared docs, FAQs, policies).
   - Add **Assistant Knowledge Base** per assistant (playbooks, role guides).
   - Configure assistants: name, description, default model (OpenAI/Anthropic/etc.), tools (image gen, web search, deep research), and access scopes (which KBs they can read).
3. **Workspace (Slack-like)**
   - Channels with assistants and humans.
   - Slash/mention commands to route queries to specific assistants.
   - Inline citations and expandable context panels in responses.

## Data Model (Conceptual)
- `companies`
- `documents` (shared/general) with embeddings + metadata
- `company_os_documents` (always indexed, highest priority)
- `assistant_documents` (per assistant)
- `assistants`: { name, description, model, tools: { imageGen, webSearch, deepResearch }, scopes: { companyOS, generalKB, assistantKB } }
- `channels`, `messages`, `message_context_logs`

## Retrieval & Context Injection Pipeline
1. **Query Parsing & Expansion**
   - Parse mentions (`@assistant`) and strip routing tokens.
   - Generate semantic expansions of the user query (top 5–8 variants) using fast LLM.
2. **Parallel Retrieval (all in ~800ms target)**
   - Tier 1: **Company OS search** (always executed, top priority).
   - Tier 2: **Assistant KB search** (filtered by assistantId + companyId).
   - Tier 3: **General KB search** (shared docs within company).
   - Hybrid: keyword/full-text search for recall.
   - Optional: structured data fetch (financials, metrics) when relevant keywords detected.
3. **Reranking**
   - Merge results and rerank with a reranker model (e.g., Cohere Rerank v3) against the exact user query.
4. **Prompt Assembly**
   - System prompt template with role definition + guardrails.
   - Insert top N chunks grouped by tier (Company OS first) with metadata for citations.
   - Append conversation history summary + user query.
5. **Generation**
   - Call selected model with tool-enabled run (image gen, web search, deep research) as configured per assistant.
   - Return response + ordered citations + retrieval stats for UI.

## Assistant Creation UI
- Form fields: name, purpose, model picker, temperature, tools toggles, knowledge scopes checkboxes, and upload section for assistant-specific docs.
- Preview pane shows prompt skeleton and sample response.
- Save creates assistant record and triggers embedding of uploaded docs.

## Admin Upload UX
- Single "Upload Company OS" call-to-action on first login.
- Drag-and-drop or file picker; progress + validation (file type, size).
- Post-upload checklist: embedding status, document count, last updated.

## Slack-like Workspace Behaviors
- `@assistant` mention routes to chosen assistant with its scoped context.
- Responses show citations (chunk source + page) and a "Context" dropdown revealing injected snippets.
- Commands: `/context refresh`, `/assistant info`, `/upload kb` shortcuts.

## Safety & Quality
- Enforce tool-use policies in system prompt (e.g., when to call web search vs. deep research).
- Filter PII and off-topic content before indexing.
- Add feedback loop: "Was this helpful?" to capture reinforcement signals and retrain reranker weights per company.

## MVP Checklist
- Minimal auth & invite flow (no multi-step wizards).
- Company OS upload + embedding pipeline.
- Assistant config with model + tools + scoped KB access.
- Unified retrieval + rerank + prompt assembly path.
- Slack-like channel chat with citations and context viewer.
