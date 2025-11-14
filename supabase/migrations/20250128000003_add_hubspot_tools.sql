-- Add HubSpot tools to the tools table
INSERT INTO public.tools (name, display_name, tool_type, description, schema_definition) VALUES
(
  'hubspot_contacts_search',
  'HubSpot Contact Search',
  'hubspot',
  'Search HubSpot contacts for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for contacts (e.g., ''john@example.com'', ''John Smith'', ''Acme Corp'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of contacts to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''email'', ''firstname'', ''lastname'', ''phone'', ''company''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_contacts_create',
  'HubSpot Contact Creation',
  'hubspot',
  'Create a new HubSpot contact',
  '{
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Contact email address (required)"
      },
      "first_name": {
        "type": "string",
        "description": "Contact''s first name"
      },
      "last_name": {
        "type": "string",
        "description": "Contact''s last name"
      },
      "phone": {
        "type": "string",
        "description": "Contact''s phone number"
      },
      "company": {
        "type": "string",
        "description": "Contact''s company name"
      },
      "job_title": {
        "type": "string",
        "description": "Contact''s job title"
      }
    },
    "required": ["email"]
  }'::jsonb
),
(
  'hubspot_contacts_update',
  'HubSpot Contact Update',
  'hubspot',
  'Update an existing HubSpot contact',
  '{
    "type": "object",
    "properties": {
      "contact_id": {
        "type": "string",
        "description": "HubSpot contact ID"
      },
      "properties": {
        "type": "object",
        "description": "Properties to update (e.g., {firstname: ''John'', lastname: ''Doe'', phone: ''+1234567890''})"
      }
    },
    "required": ["contact_id", "properties"]
  }'::jsonb
),
(
  'hubspot_companies_search',
  'HubSpot Company Search',
  'hubspot',
  'Search HubSpot companies for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for companies (e.g., ''Acme Corp'', ''tech startup'', ''manufacturing'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of companies to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''name'', ''domain'', ''industry'', ''city'', ''state''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_companies_create',
  'HubSpot Company Creation',
  'hubspot',
  'Create a new HubSpot company',
  '{
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Company name (required)"
      },
      "domain": {
        "type": "string",
        "description": "Company domain"
      },
      "industry": {
        "type": "string",
        "description": "Company industry"
      },
      "city": {
        "type": "string",
        "description": "Company city"
      },
      "state": {
        "type": "string",
        "description": "Company state"
      },
      "country": {
        "type": "string",
        "description": "Company country"
      }
    },
    "required": ["name"]
  }'::jsonb
),
(
  'hubspot_deals_search',
  'HubSpot Deal Search',
  'hubspot',
  'Search HubSpot deals for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for deals (e.g., ''Q4 deal'', ''enterprise'', ''renewal'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of deals to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''dealname'', ''dealstage'', ''amount'', ''closedate''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_deals_create',
  'HubSpot Deal Creation',
  'hubspot',
  'Create a new HubSpot deal',
  '{
    "type": "object",
    "properties": {
      "deal_name": {
        "type": "string",
        "description": "Deal name (required)"
      },
      "deal_stage": {
        "type": "string",
        "description": "Deal stage (e.g., ''appointmentscheduled'', ''qualifiedtobuy'', ''presentationscheduled'')"
      },
      "amount": {
        "type": "number",
        "description": "Deal amount"
      },
      "currency": {
        "type": "string",
        "description": "Currency code (e.g., ''USD'', ''EUR'')"
      },
      "close_date": {
        "type": "string",
        "description": "Expected close date (ISO 8601 format)"
      },
      "deal_type": {
        "type": "string",
        "description": "Deal type (e.g., ''newbusiness'', ''existingbusiness'')"
      }
    },
    "required": ["deal_name"]
  }'::jsonb
),
(
  'hubspot_deals_update',
  'HubSpot Deal Update',
  'hubspot',
  'Update an existing HubSpot deal',
  '{
    "type": "object",
    "properties": {
      "deal_id": {
        "type": "string",
        "description": "HubSpot deal ID"
      },
      "properties": {
        "type": "object",
        "description": "Properties to update (e.g., {dealstage: ''closedwon'', amount: ''50000''})"
      }
    },
    "required": ["deal_id", "properties"]
  }'::jsonb
),
(
  'hubspot_tickets_search',
  'HubSpot Ticket Search',
  'hubspot',
  'Search HubSpot tickets for relevant information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for tickets (e.g., ''urgent'', ''billing'', ''login issue'')"
      },
      "limit": {
        "type": "number",
        "description": "Maximum number of tickets to return (default: 10)",
        "default": 10
      },
      "properties": {
        "type": "array",
        "description": "Specific properties to return (e.g., [''subject'', ''content'', ''priority'', ''ticket_status''])",
        "items": { "type": "string" }
      }
    },
    "required": ["query"]
  }'::jsonb
),
(
  'hubspot_tickets_create',
  'HubSpot Ticket Creation',
  'hubspot',
  'Create a new HubSpot ticket',
  '{
    "type": "object",
    "properties": {
      "subject": {
        "type": "string",
        "description": "Ticket subject (required)"
      },
      "content": {
        "type": "string",
        "description": "Ticket content or description"
      },
      "priority": {
        "type": "string",
        "description": "Ticket priority (e.g., ''LOW'', ''MEDIUM'', ''HIGH'')"
      },
      "ticket_status": {
        "type": "string",
        "description": "Ticket status (e.g., ''NEW'', ''OPEN'', ''PENDING'')"
      },
      "category": {
        "type": "string",
        "description": "Ticket category (e.g., ''QUESTION'', ''PROBLEM'', ''REQUEST'')"
      }
    },
    "required": ["subject"]
  }'::jsonb
);

-- Add HubSpot tools to all existing agents by default
INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
SELECT 
  a.id as agent_id,
  t.id as tool_id,
  true as is_enabled,
  '{}'::jsonb as configuration
FROM public.agents a
CROSS JOIN public.tools t
WHERE t.tool_type = 'hubspot'
AND NOT EXISTS (
  SELECT 1 FROM public.agent_tools at 
  WHERE at.agent_id = a.id AND at.tool_id = t.id
);

-- Create a function to automatically add HubSpot tools to new agents
CREATE OR REPLACE FUNCTION add_hubspot_tools_to_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Add all HubSpot tools to the newly created agent
  INSERT INTO public.agent_tools (agent_id, tool_id, is_enabled, configuration)
  SELECT 
    NEW.id as agent_id,
    t.id as tool_id,
    true as is_enabled,
    '{}'::jsonb as configuration
  FROM public.tools t
  WHERE t.tool_type = 'hubspot';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add HubSpot tools to new agents
CREATE TRIGGER trigger_add_hubspot_tools_to_new_agent
  AFTER INSERT ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION add_hubspot_tools_to_new_agent();

COMMENT ON TABLE public.agent_tools IS 'Links agents to available tools. HubSpot tools provide CRM capabilities including contact, company, deal, and ticket management.';
