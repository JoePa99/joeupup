-- Add Calendar Tools to the tools table
INSERT INTO tools (id, name, display_name, description, tool_type, schema_definition, is_active) VALUES
  (
    gen_random_uuid(),
    'calendar_list_events',
    'Google Calendar Events',
    'List and search Google Calendar events',
    'gsuite',
    '{
      "actions": ["list", "search"],
      "parameters": {
        "list": {
          "calendarId": {"type": "string", "default": "primary"},
          "timeMin": {"type": "string", "description": "ISO 8601 datetime"},
          "timeMax": {"type": "string", "description": "ISO 8601 datetime"},
          "maxResults": {"type": "number", "default": 10},
          "query": {"type": "string", "description": "Search query"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_create_event',
    'Create Calendar Event',
    'Create new Google Calendar events',
    'gsuite',
    '{
      "actions": ["create"],
      "parameters": {
        "create": {
          "summary": {"type": "string", "required": true},
          "description": {"type": "string"},
          "start": {"type": "object", "required": true},
          "end": {"type": "object", "required": true},
          "location": {"type": "string"},
          "attendees": {"type": "array"},
          "calendarId": {"type": "string", "default": "primary"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_update_event',
    'Update Calendar Event',
    'Update existing Google Calendar events',
    'gsuite',
    '{
      "actions": ["update"],
      "parameters": {
        "update": {
          "eventId": {"type": "string", "required": true},
          "summary": {"type": "string"},
          "description": {"type": "string"},
          "start": {"type": "object"},
          "end": {"type": "object"},
          "location": {"type": "string"},
          "attendees": {"type": "array"},
          "calendarId": {"type": "string", "default": "primary"}
        }
      }
    }'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'calendar_delete_event',
    'Delete Calendar Event',
    'Delete Google Calendar events',
    'gsuite',
    '{
      "actions": ["delete"],
      "parameters": {
        "delete": {
          "eventId": {"type": "string", "required": true},
          "calendarId": {"type": "string", "default": "primary"},
          "sendUpdates": {"type": "string", "enum": ["all", "externalOnly", "none"], "default": "all"}
        }
      }
    }'::jsonb,
    true
  );