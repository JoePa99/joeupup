-- Create Default Playbook Sections for All Existing Companies
-- ===========================================================
-- This script creates the standard 8 playbook sections for all companies
-- that don't already have playbook sections.

-- Insert default playbook sections for all existing companies
-- Only insert if the company doesn't already have any playbook sections

INSERT INTO public.playbook_sections (
    company_id,
    title,
    content,
    section_order,
    status,
    progress_percentage,
    tags,
    created_at,
    updated_at
)
SELECT 
    c.id as company_id,
    template.title,
    template.description as content,
    template.section_order as section_order,
    'draft'::playbook_status as status,
    0 as progress_percentage,
    template.tags,
    now() as created_at,
    now() as updated_at
FROM public.companies c
CROSS JOIN (
    VALUES 
        ('Mission & Vision', 'Company mission statement, vision, and core values', ARRAY['sales', 'support', 'hr'], 1),
        ('Value Proposition', 'What makes your company unique and valuable to customers', ARRAY['sales', 'marketing'], 2),
        ('Customer Segments', 'Target customer profiles and market segments', ARRAY['sales', 'marketing', 'support'], 3),
        ('SWOT Analysis', 'Strengths, Weaknesses, Opportunities, and Threats', ARRAY['operations', 'sales'], 4),
        ('Standard Operating Procedures', 'Step-by-step operational procedures and workflows', ARRAY['operations', 'support'], 5),
        ('Team Roles & Responsibilities', 'Organizational structure and role definitions', ARRAY['hr', 'operations'], 6),
        ('Tools & Integrations', 'Software tools, platforms, and system integrations', ARRAY['operations', 'support'], 7),
        ('Compliance & Legal', 'Legal requirements, compliance standards, and policies', ARRAY['operations', 'hr'], 8)
) AS template(title, description, tags, section_order)
WHERE NOT EXISTS (
    -- Only insert for companies that don't already have any playbook sections
    SELECT 1 
    FROM public.playbook_sections ps 
    WHERE ps.company_id = c.id
);

-- Optional: If you want to add sections to ALL companies (including those that already have some sections),
-- use this version instead (comment out the above and uncomment this):

/*
INSERT INTO public.playbook_sections (
    company_id,
    title,
    content,
    section_order,
    status,
    progress_percentage,
    tags,
    created_at,
    updated_at
)
SELECT 
    c.id as company_id,
    template.title,
    template.description as content,
    template.section_order as section_order,
    'draft'::playbook_status as status,
    0 as progress_percentage,
    template.tags,
    now() as created_at,
    now() as updated_at
FROM public.companies c
CROSS JOIN (
    VALUES 
        ('Mission & Vision', 'Company mission statement, vision, and core values', ARRAY['sales', 'support', 'hr'], 1),
        ('Value Proposition', 'What makes your company unique and valuable to customers', ARRAY['sales', 'marketing'], 2),
        ('Customer Segments', 'Target customer profiles and market segments', ARRAY['sales', 'marketing', 'support'], 3),
        ('SWOT Analysis', 'Strengths, Weaknesses, Opportunities, and Threats', ARRAY['operations', 'sales'], 4),
        ('Standard Operating Procedures', 'Step-by-step operational procedures and workflows', ARRAY['operations', 'support'], 5),
        ('Team Roles & Responsibilities', 'Organizational structure and role definitions', ARRAY['hr', 'operations'], 6),
        ('Tools & Integrations', 'Software tools, platforms, and system integrations', ARRAY['operations', 'support'], 7),
        ('Compliance & Legal', 'Legal requirements, compliance standards, and policies', ARRAY['operations', 'hr'], 8)
) AS template(title, description, tags, section_order)
WHERE NOT EXISTS (
    -- Only insert if this specific section doesn't already exist for this company
    SELECT 1 
    FROM public.playbook_sections ps 
    WHERE ps.company_id = c.id 
    AND ps.title = template.title
);
*/

-- Verification query to check the results
SELECT 
    c.name as company_name,
    COUNT(ps.id) as playbook_sections_count,
    ARRAY_AGG(ps.title ORDER BY ps.section_order) as section_titles
FROM public.companies c
LEFT JOIN public.playbook_sections ps ON c.id = ps.company_id
GROUP BY c.id, c.name
ORDER BY c.name;
