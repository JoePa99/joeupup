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

### AI Context Injection Flow
1. User sends message to AI agent
2. Chat function fetches agent's company_id
3. Queries company_os table for that company
4. Formats CompanyOS as markdown context
5. Injects into system prompt BEFORE document context
6. AI uses this context to inform all responses

### Context Structure
The CompanyOS context includes:
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

