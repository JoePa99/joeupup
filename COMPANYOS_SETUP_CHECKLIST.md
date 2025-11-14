# CompanyOS Setup Checklist

## ✅ Completed Implementation

All code has been written and is ready to deploy. Here's what was created:

### Database
- [x] Migration file created: `supabase/migrations/20250114000000_create_company_os_table.sql`
- [x] Table schema with JSONB storage
- [x] RLS policies configured
- [x] Indexes for performance

### Backend
- [x] Edge function: `supabase/functions/generate-company-os/index.ts`
- [x] Perplexity API integration
- [x] CompanyOS generation logic
- [x] AI context injection in `chat-with-agent`

### Frontend
- [x] TypeScript types: `src/types/company-os.ts`
- [x] Utility functions: `src/lib/company-os.ts`
- [x] Generator component: `src/components/company-os/CompanyOSGenerator.tsx`
- [x] Viewer component: `src/components/company-os/CompanyOSViewer.tsx`
- [x] Editor component: `src/components/company-os/CompanyOSEditor.tsx`
- [x] Playbook integration: `src/pages/Playbook.tsx`

### Documentation
- [x] Implementation guide: `COMPANYOS_IMPLEMENTATION.md`
- [x] Setup checklist: This file

## 🔧 Required Setup Steps

To activate the CompanyOS feature, complete these steps:

### 1. Apply Database Migration
```bash
# Option A: Push to remote database
npx supabase db push

# Option B: Apply locally (if using local dev)
npx supabase migration up
```

**Expected Output**: Migration applied successfully, `company_os` table created.

### 2. Regenerate TypeScript Types
```bash
# For remote database
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts

# For local database
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

**Expected Output**: Updated `types.ts` file with `company_os` table definition.

### 3. Set Perplexity API Key

Get your API key from [Perplexity](https://www.perplexity.ai/), then:

```bash
# Set in Supabase (production)
npx supabase secrets set PERPLEXITY_API_KEY=pplx-xxxxx

# Set in local environment
# Add to .env.local:
PERPLEXITY_API_KEY=pplx-xxxxx
```

**Expected Output**: Secret set successfully.

### 4. Deploy Edge Function
```bash
npx supabase functions deploy generate-company-os
```

**Expected Output**: Function deployed successfully.

### 5. Verify Setup
1. Start your dev server: `npm run dev`
2. Navigate to `/playbook`
3. Click "CompanyOS" tab
4. Verify the generator form appears

## 🧪 Testing the Feature

### Test 1: Generate CompanyOS
1. Go to Playbook → CompanyOS tab
2. Enter company details:
   - **Company Name**: Test Company Inc.
   - **Industry**: SaaS
   - **Website**: https://example.com (optional)
3. Click "Generate CompanyOS"
4. Wait 30-60 seconds
5. Verify CompanyOS is displayed

### Test 2: View CompanyOS
1. After generation, verify:
   - Stats cards show (completeness, version, assumptions, date)
   - All sections display correctly
   - SWOT analysis is color-coded
   - Values and competencies are listed

### Test 3: Edit CompanyOS
1. Click "Edit CompanyOS" button
2. Navigate through tabs (Core Identity, Market Context, Brand Voice)
3. Make a change (e.g., edit mission statement)
4. Click "Save Changes"
5. Verify version increments
6. Verify changes are saved

### Test 4: AI Context Injection
1. Go to chat with any AI agent
2. Ask a question like "What are our company values?"
3. Verify AI responds with values from CompanyOS
4. Ask "What's our brand voice?"
5. Verify AI uses CompanyOS brand voice guidelines

## 📋 Verification Checklist

After setup, verify each of these:

- [ ] Migration applied successfully (check Supabase dashboard)
- [ ] `company_os` table exists in database
- [ ] TypeScript types regenerated (no type errors in `src/lib/company-os.ts`)
- [ ] Perplexity API key configured (check Supabase secrets)
- [ ] Edge function deployed (check Supabase functions list)
- [ ] CompanyOS tab visible in Playbook
- [ ] Generator form loads without errors
- [ ] Can generate CompanyOS successfully
- [ ] Generated data displays correctly
- [ ] Can edit and save CompanyOS
- [ ] AI agents receive CompanyOS context (check logs)
- [ ] AI responses reflect company context

## 🐛 Common Issues & Solutions

### Issue: Type errors in `company-os.ts`
**Solution**: Regenerate types after applying migration
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

### Issue: "Perplexity API key not configured"
**Solution**: Ensure secret is set correctly
```bash
npx supabase secrets list  # Verify it exists
npx supabase secrets set PERPLEXITY_API_KEY=pplx-xxxxx  # Set if missing
```

### Issue: "Failed to generate CompanyOS"
**Solution**: 
1. Check Perplexity API key is valid
2. Check edge function logs: `npx supabase functions logs generate-company-os`
3. Verify function is deployed: `npx supabase functions list`

### Issue: CompanyOS not showing in AI responses
**Solution**:
1. Verify CompanyOS exists: Check Playbook → CompanyOS tab
2. Check agent's company_id is set correctly
3. Review chat-with-agent logs for CompanyOS fetch
4. Verify `os_data` field is valid JSON

### Issue: Migration fails
**Solution**:
1. Check for conflicts with existing schema
2. Verify you have database admin permissions
3. Try applying migration manually via SQL editor

## 🚀 Quick Start Commands

For a fresh setup, run these commands in order:

```bash
# 1. Apply migration
npx supabase db push

# 2. Regenerate types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts

# 3. Set API key
npx supabase secrets set PERPLEXITY_API_KEY=your_key_here

# 4. Deploy function
npx supabase functions deploy generate-company-os

# 5. Start dev server
npm run dev
```

## 📊 Success Metrics

You'll know the feature is working when:

1. **Generation**: CompanyOS generates in 30-60 seconds with real research data
2. **Storage**: Data persists and can be viewed/edited
3. **Versioning**: Each edit increments version number
4. **Assumptions**: Items marked "(Assumed)" are highlighted
5. **AI Context**: Agents respond with company-specific knowledge
6. **Brand Voice**: AI responses match brand voice guidelines
7. **No Errors**: Console is clean, no TypeScript errors

## 🎯 Next Steps

After successful setup:

1. **Generate CompanyOS for your company**
   - Use real company name and website
   - Provide specific context for better results
   - Review and refine generated content

2. **Test with AI agents**
   - Ask questions about company values
   - Request brand-aligned content
   - Verify tone matches brand voice

3. **Train your team**
   - Show them how to view CompanyOS
   - Explain how it enhances AI responses
   - Demonstrate editing capabilities

4. **Schedule updates**
   - Plan quarterly reviews
   - Update when major changes occur
   - Keep data current

## 📞 Support

If you encounter issues not covered here:

1. Check `COMPANYOS_IMPLEMENTATION.md` for detailed documentation
2. Review Supabase function logs for backend issues
3. Check browser console for frontend errors
4. Verify all setup steps were completed

---

**Ready to go!** Follow the setup steps above to activate CompanyOS. 🚀

