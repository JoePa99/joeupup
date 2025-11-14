# Agent Chain Feature - Testing Guide

## Quick Test Commands

### Test 1: Basic Two-Agent Chain
**Purpose:** Verify basic chain functionality

**Message:**
```
@marketing_agent write a short LinkedIn post about AI innovation, then @image_generator create a relevant image
```

**Expected Result:**
1. User message appears immediately
2. Marketing agent responds with LinkedIn post
3. "→ Chained response #2" indicator appears
4. Image generator creates image based on the post

**What to Check:**
- ✓ Both responses appear in order
- ✓ Chain indicator shows for second response
- ✓ Image is relevant to the post content
- ✓ No errors in console

---

### Test 2: Triple Chain
**Purpose:** Verify multiple chained agents

**Message:**
```
@researcher find 3 facts about climate change, @writer summarize them in bullet points, @editor polish the text
```

**Expected Result:**
1. Researcher provides 3 facts
2. "→ Chained response #2" - Writer creates bullets
3. "→ Chained response #3" - Editor polishes

**What to Check:**
- ✓ All three agents respond in order
- ✓ Chain indicators show #2 and #3
- ✓ Each agent builds on previous work
- ✓ Context is maintained throughout

---

### Test 3: Duplicate Mention
**Purpose:** Verify deduplication

**Message:**
```
@marketing_agent write a post @marketing_agent then @image_generator create image
```

**Expected Result:**
1. Marketing agent responds once
2. Image generator responds

**What to Check:**
- ✓ Marketing agent only executes once
- ✓ Duplicate mention is ignored
- ✓ Chain continues normally

---

### Test 4: Error Handling
**Purpose:** Verify graceful error handling

**Message:**
```
@marketing_agent write a post, @nonexistent_agent do something, @image_generator create image
```

**Expected Result:**
1. Marketing agent responds successfully
2. Error message appears for invalid agent
3. Image generator does NOT run (chain stops)

**What to Check:**
- ✓ First agent completes
- ✓ Error message is clear
- ✓ Chain stops at error
- ✓ No crash or frozen UI

---

### Test 5: Mixed Content Types
**Purpose:** Verify different content types in chain

**Message:**
```
@web_researcher find information about React 19, @writer create a blog post about it
```

**Expected Result:**
1. Web researcher provides web research results
2. Writer creates blog post using the research

**What to Check:**
- ✓ Web research formatting displays correctly
- ✓ Writer incorporates research data
- ✓ Different content types render properly

---

## Console Debugging

### Key Log Messages to Look For:

**Frontend (Browser Console):**
```javascript
🔍 [DEBUG] Detecting all agent mentions...
🔍 [DEBUG] All agent mentions detected: [...]
🔍 [DEBUG] Agent chain will be processed: [...]
🔍 [DEBUG] Calling chat-with-agent-channel with payload: {...}
```

**Backend (Edge Function Logs):**
```javascript
Starting agent chain with N agents
Processing chain: agent <id> (index N), M remaining
Agent chain completed
```

---

## Database Verification

### Check User Message:
```sql
SELECT 
  id,
  content,
  agent_id,
  agent_chain,
  chain_index
FROM chat_messages
WHERE role = 'user'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `agent_id`: First agent's ID
- `agent_chain`: Array of remaining agent IDs
- `chain_index`: 0

### Check Chained Responses:
```sql
SELECT 
  id,
  content,
  agent_id,
  chain_index,
  parent_message_id,
  mention_type,
  created_at
FROM chat_messages
WHERE parent_message_id = '<user_message_id>'
ORDER BY chain_index;
```

**Expected:**
- Sequential `chain_index` values (1, 2, 3...)
- `mention_type`: 'chain_mention' for index > 0
- Same `parent_message_id` for all

---

## Common Issues & Solutions

### Issue: Second agent doesn't trigger
**Check:**
1. Is `agent_chain` populated in user message?
2. Are edge function logs showing chain processing?
3. Is there an error in first agent response?

**Solution:** Check console for errors, verify agent IDs are valid

---

### Issue: Chain indicator doesn't show
**Check:**
1. Is `chain_index` field in database?
2. Is real-time subscription including new fields?
3. Is component receiving the field?

**Solution:** Check migration ran, verify field in console logs

---

### Issue: Context not passed correctly
**Check:**
1. View backend logs for "Previous Agent Responses" section
2. Verify agent receives combined message

**Solution:** Check `processAgentChain` context building logic

---

### Issue: Duplicate responses
**Check:**
1. Real-time subscription deduplication
2. Client message ID matching

**Solution:** Check `dedupeMessages` function execution

---

## Performance Testing

### Test Long Chains:
```
@agent1 task1, @agent2 task2, @agent3 task3, @agent4 task4, @agent5 task5
```

**Monitor:**
- Response times for each agent
- Memory usage
- Edge function timeout limits
- Database query performance

**Acceptable Performance:**
- Each agent: < 10 seconds
- Total chain: < 60 seconds for 5 agents
- No memory leaks
- No timeout errors

---

## Rollback Plan

If critical issues found:

1. **Quick Fix:** Disable chain processing in frontend
```typescript
// In sendChannelMessage, comment out:
// agent_chain: agentChain.length > 0 ? agentChain : null,
```

2. **Database Rollback:** Drop new columns
```sql
ALTER TABLE chat_messages 
DROP COLUMN agent_chain,
DROP COLUMN chain_index,
DROP COLUMN parent_message_id;
```

3. **Edge Function Rollback:** Deploy previous version

---

## Success Criteria

✅ **Feature Complete When:**
- [ ] All 5 test scenarios pass
- [ ] No console errors during tests
- [ ] Visual indicators display correctly
- [ ] Performance is acceptable
- [ ] Error handling works gracefully
- [ ] Real-time updates work smoothly
- [ ] Context passes correctly between agents
- [ ] Database queries are efficient

---

## Next Steps After Testing

1. Document any issues found
2. Adjust configuration if needed
3. Create user documentation
4. Train team on new feature
5. Monitor production usage
6. Gather user feedback
7. Plan enhancements

---

## Support Commands

### Clear Test Data:
```sql
DELETE FROM chat_messages 
WHERE created_at > NOW() - INTERVAL '1 hour'
AND role = 'user';
```

### Check Agent List:
```sql
SELECT id, name, nickname 
FROM agents 
WHERE company_id = '<your_company_id>'
ORDER BY name;
```

### Monitor Active Chains:
```sql
SELECT 
  cm.id,
  cm.content,
  cm.chain_index,
  cm.agent_chain,
  a.name as agent_name
FROM chat_messages cm
LEFT JOIN agents a ON cm.agent_id = a.id
WHERE cm.agent_chain IS NOT NULL 
  OR cm.parent_message_id IS NOT NULL
ORDER BY cm.created_at DESC
LIMIT 20;
```








