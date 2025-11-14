# Delete All OpenAI Assistants Function

This Supabase Edge Function deletes all OpenAI assistants associated with agents in your database.

## What it does

1. **Fetches all agents** that have an `assistant_id` from your `agents` table
2. **Deletes each OpenAI assistant** using the OpenAI API
3. **Updates your database** to remove the `assistant_id` and `vector_store_id` references
4. **Provides detailed results** of successful and failed deletions

## Features

- **Company-specific deletion**: Optionally delete assistants for a specific company only
- **Comprehensive logging**: Detailed logs for debugging and monitoring
- **Error handling**: Graceful handling of API failures and network issues
- **Database cleanup**: Automatically removes assistant references from your agents table
- **Batch processing**: Processes all assistants in a single function call

## Deployment

1. **Deploy the function** to your Supabase project:
   ```bash
   supabase functions deploy delete-all-assistants
   ```

2. **Set environment variables** in your Supabase dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Usage

### Option 1: Using the test script

1. Update the configuration in `scripts/delete-assistants.js`:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   const USER_ID = 'your-user-id';
   const COMPANY_ID = null; // or specific company ID
   ```

2. Install dependencies and run:
   ```bash
   npm install node-fetch
   node scripts/delete-assistants.js
   ```

### Option 2: Direct API call

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/delete-all-assistants' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "your-user-id",
    "company_id": null
  }'
```

### Option 3: From your application

```typescript
const response = await fetch('/functions/v1/delete-all-assistants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseClient.auth.session()?.access_token}`
  },
  body: JSON.stringify({
    user_id: currentUser.id,
    company_id: currentCompany.id // optional
  })
});

const result = await response.json();
```

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | ✅ | The user ID making the request |
| `company_id` | string | ❌ | If provided, only delete assistants for this company |

## Response Format

```json
{
  "success": true,
  "message": "Deletion process completed",
  "results": {
    "successful": ["asst_abc123", "asst_def456"],
    "failed": [
      {
        "agent_id": "uuid-here",
        "name": "Agent Name",
        "error": "Error message"
      }
    ],
    "total": 2
  },
  "summary": {
    "total_agents": 2,
    "successfully_deleted": 2,
    "failed_deletions": 0
  }
}
```

## Safety Features

- **Validation**: Requires user authentication
- **Logging**: Comprehensive logging for audit trails
- **Error handling**: Continues processing even if individual deletions fail
- **Database cleanup**: Automatically removes references to deleted assistants

## Important Notes

⚠️ **This action is irreversible!** Once you delete OpenAI assistants, they cannot be recovered.

⚠️ **Make sure you have backups** of your database before running this function.

⚠️ **Test in development first** before running in production.

## Troubleshooting

### Common Issues

1. **Missing environment variables**: Ensure all required environment variables are set
2. **Permission errors**: Check that your Supabase service role key has the necessary permissions
3. **OpenAI API limits**: The function handles rate limiting gracefully, but very large numbers of assistants may take time

### Monitoring

Check the Supabase Edge Function logs in your dashboard to monitor the deletion process and identify any issues.

## Support

If you encounter issues, check the function logs in your Supabase dashboard or review the error messages in the response.
