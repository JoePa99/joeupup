-- Clean up duplicate agents created during onboarding
-- This migration removes duplicate agents that were created due to multiple calls to create-agent-indexes

-- First, let's identify and log duplicate agents for debugging
DO $$
DECLARE
    company_record RECORD;
    agent_record RECORD;
    duplicate_count INTEGER;
BEGIN
    -- Log companies with potential duplicate agents
    FOR company_record IN 
        SELECT company_id, COUNT(*) as agent_count
        FROM agents 
        WHERE status = 'active'
        GROUP BY company_id 
        HAVING COUNT(*) > 3  -- Assuming normal case has 3 agents per company
    LOOP
        RAISE NOTICE 'Company % has % agents (potential duplicates)', company_record.company_id, company_record.agent_count;
    END LOOP;
END $$;

-- Remove duplicate agents based on company_id and agent_type_id
-- Keep the first created agent of each type per company
DELETE FROM agents 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY company_id, agent_type_id 
                   ORDER BY created_at ASC
               ) as rn
        FROM agents 
        WHERE status = 'active'
    ) ranked
    WHERE rn > 1
);

-- Clean up orphaned chat conversations for deleted agents
DELETE FROM chat_conversations 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned channel agents for deleted agents
DELETE FROM channel_agents 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent conversations for deleted agents
DELETE FROM agent_conversations 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent metrics for deleted agents
DELETE FROM agent_metrics 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Clean up orphaned agent tag assignments for deleted agents
DELETE FROM agent_tag_assignments 
WHERE agent_id NOT IN (
    SELECT id FROM agents WHERE status = 'active'
);

-- Add a unique constraint to prevent future duplicates
-- This will ensure only one active agent per agent_type per company
ALTER TABLE agents 
ADD CONSTRAINT unique_agent_type_per_company 
UNIQUE (company_id, agent_type_id, status);

-- Log the cleanup results
DO $$
DECLARE
    total_agents INTEGER;
    companies_with_agents INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_agents FROM agents WHERE status = 'active';
    SELECT COUNT(DISTINCT company_id) INTO companies_with_agents FROM agents WHERE status = 'active';
    
    RAISE NOTICE 'Cleanup complete: % active agents across % companies', total_agents, companies_with_agents;
END $$;

