-- Create default agent-tool relationships for existing agents
DO $$
DECLARE
    agent_rec RECORD;
    tool_rec RECORD;
BEGIN
    -- For each existing agent, assign all G Suite tools by default
    FOR agent_rec IN (SELECT id FROM public.agents) LOOP
        FOR tool_rec IN (SELECT id FROM public.tools WHERE tool_type = 'gsuite') LOOP
            INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled)
            VALUES (agent_rec.id, tool_rec.id, true)
            ON CONFLICT (agent_id, tool_id) DO NOTHING;
        END LOOP;
    END LOOP;
END
$$;