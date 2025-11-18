# Supabase Deployment Commands

## Deploy Single Function
```bash
npx supabase functions deploy create-workspace
```

## Deploy All Functions
```bash
npx supabase functions deploy
```

## Deploy with Debug Output
```bash
npx supabase functions deploy create-workspace --debug
```

## Deploy Specific Functions
```bash
# Deploy multiple specific functions
npx supabase functions deploy create-workspace
npx supabase functions deploy chat-with-agent-v2
npx supabase functions deploy research-company
```

## Common Issues

### Issue: "entrypoint path does not exist"
**Cause:** Function name is incorrect in the command
**Fix:** Make sure you're using the correct function name from `supabase/functions/` directory

### Issue: Command syntax error
**Wrong:** `npx supabase functions deploy deploy create-workspace`
**Correct:** `npx supabase functions deploy create-workspace`

(The word "deploy" should only appear once after "functions")

## Project Info
- Project ID: mzqlkhysicqtrahllkng
- Project URL: https://mzqlkhysicqtrahllkng.supabase.co

## Note on .env Mismatch
Your `.env` file has a mismatch:
- `VITE_SUPABASE_PROJECT_ID` = `mzqlkhysicqtrahllkng` ✓
- `VITE_SUPABASE_PUBLISHABLE_KEY` contains ref = `chaeznzfvbgrpzvxwvyu` ✗

You may need to get the correct publishable key from the Supabase dashboard for project `mzqlkhysicqtrahllkng`.
