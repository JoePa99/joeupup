-- Add columns to document_archives for playbook integration
ALTER TABLE document_archives 
ADD COLUMN IF NOT EXISTS playbook_section_id uuid REFERENCES playbook_sections(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_editable boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_archives_section_id ON document_archives(playbook_section_id);
CREATE INDEX IF NOT EXISTS idx_document_archives_editable ON document_archives(is_editable);

-- Function to create default playbook sections for a new company
CREATE OR REPLACE FUNCTION create_default_playbook_sections(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sections text[][] := ARRAY[
    ARRAY['Mission & Vision', 'mission-vision', 'Define your company''s purpose, core values, and long-term aspirations'],
    ARRAY['Value Proposition', 'value-proposition', 'Articulate the unique value you provide to customers'],
    ARRAY['Customer Segments', 'customer-segments', 'Identify and describe your target customer groups'],
    ARRAY['SWOT Analysis', 'swot', 'Analyze strengths, weaknesses, opportunities, and threats'],
    ARRAY['Standard Operating Procedures', 'sops', 'Document step-by-step processes for key operations'],
    ARRAY['Team Roles & Responsibilities', 'team-roles', 'Define organizational structure and role expectations'],
    ARRAY['Tools & Integrations', 'tools', 'List and describe your technology stack and integrations'],
    ARRAY['Compliance & Legal', 'compliance-legal', 'Document compliance requirements and legal considerations']
  ];
  section_data text[];
  section_order_num integer := 0;
BEGIN
  FOREACH section_data SLICE 1 IN ARRAY sections
  LOOP
    INSERT INTO playbook_sections (
      company_id,
      title,
      content,
      tags,
      status,
      progress_percentage,
      section_order
    ) VALUES (
      p_company_id,
      section_data[1],
      section_data[3],
      ARRAY[section_data[2], 'default-template'],
      'draft',
      0,
      section_order_num
    );
    section_order_num := section_order_num + 1;
  END LOOP;
END;
$$;

-- Trigger to automatically create playbook sections when a company is created
CREATE OR REPLACE FUNCTION trigger_create_default_playbook_sections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_default_playbook_sections(NEW.id);
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_company_created_create_playbook_sections ON companies;
CREATE TRIGGER on_company_created_create_playbook_sections
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_playbook_sections();

-- Create default sections for existing companies that don't have any
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT c.id 
    FROM companies c
    LEFT JOIN playbook_sections ps ON ps.company_id = c.id
    WHERE ps.id IS NULL
    GROUP BY c.id
  LOOP
    PERFORM create_default_playbook_sections(company_record.id);
  END LOOP;
END;
$$;