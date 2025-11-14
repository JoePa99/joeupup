import { supabase } from '@/integrations/supabase/client';
import { htmlToMarkdown } from '@/components/playbook/rich-text-editor';

export interface PlaybookDocumentData {
  title: string;
  sectionType: string;
  content: string;
  description?: string;
  companyId: string;
  userId: string;
}

export interface PlaybookSectionData {
  company_id: string;
  title: string;
  content: string;
  tags: string[];
  status: 'draft' | 'in_progress' | 'complete';
  section_order?: number;
}

/**
 * Create a playbook document and optionally add it to the knowledge base
 */
export async function createPlaybookDocument(
  data: PlaybookDocumentData,
  addToKnowledgeBase = false
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  try {
    // Convert HTML content to Markdown
    const markdownContent = htmlToMarkdown(data.content);
    
    // Create filename
    const timestamp = Date.now();
    const sanitizedTitle = data.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    const filename = `playbook-${data.sectionType}-${sanitizedTitle}-${timestamp}.md`;
    
    // Upload to Supabase Storage
    const filePath = `${data.userId}/playbook/${filename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, new Blob([markdownContent], { type: 'text/markdown' }));

    if (uploadError) throw uploadError;

    // Insert into document_archives
    const { data: documentData, error: documentError } = await supabase
      .from('document_archives')
      .insert({
        name: data.title,
        file_name: filename,
        file_type: 'text/markdown',
        file_size: markdownContent.length,
        storage_path: filePath,
        uploaded_by: data.userId,
        company_id: data.companyId,
        doc_type: 'template',
        description: data.description || null,
        tags: ['playbook', data.sectionType],
      })
      .select()
      .single();

    if (documentError) throw documentError;

    // If addToKnowledgeBase is true, trigger embeddings processing
    if (addToKnowledgeBase && documentData) {
      await processDocumentForKnowledgeBase(documentData.id, data.companyId);
    }

    return { 
      success: true, 
      documentId: documentData.id 
    };

  } catch (error) {
    console.error('Error creating playbook document:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Process a document for knowledge base embeddings
 */
export async function processDocumentForKnowledgeBase(
  documentId: string, 
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all agents for the company to add the document to their knowledge base
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id')
      .eq('company_id', companyId);

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return { 
        success: false, 
        error: 'No agents found for this company' 
      };
    }

    // Use the existing process-documents function
    const { error: processError } = await supabase.functions.invoke('process-documents', {
      body: {
        document_id: documentId,
        agent_ids: agents.map(agent => agent.id),
      }
    });

    if (processError) throw processError;

    return { success: true };

  } catch (error) {
    console.error('Error processing document for knowledge base:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create or update a playbook section
 */
export async function savePlaybookSection(
  data: PlaybookSectionData,
  sectionId?: string
): Promise<{ success: boolean; sectionId?: string; error?: string }> {
  try {
    if (sectionId) {
      // Update existing section
      const { data: updatedSection, error: updateError } = await supabase
        .from('playbook_sections')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log activity
      await logPlaybookActivity(sectionId, 'updated', data.company_id);

      return { 
        success: true, 
        sectionId: updatedSection.id 
      };
    } else {
      // Create new section
      const { data: newSection, error: createError } = await supabase
        .from('playbook_sections')
        .insert({
          ...data,
          section_order: data.section_order || 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Log activity
      await logPlaybookActivity(newSection.id, 'created', data.company_id);

      return { 
        success: true, 
        sectionId: newSection.id 
      };
    }
  } catch (error) {
    console.error('Error saving playbook section:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Log playbook activity
 */
export async function logPlaybookActivity(
  sectionId: string,
  action: string,
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    // Get current user if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id;
    }

    if (!currentUserId) return;

    await supabase
      .from('playbook_activity')
      .insert({
        section_id: sectionId,
        action,
        user_id: currentUserId,
        company_id: companyId,
        metadata: {}
      });
  } catch (error) {
    console.error('Error logging playbook activity:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Create a version snapshot of a playbook section
 */
export async function createPlaybookVersion(
  sectionId: string,
  content: string,
  versionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: section } = await supabase
      .from('playbook_sections')
      .select('title, company_id, status, progress_percentage, tags')
      .eq('id', sectionId)
      .single();

    if (!section) {
      return { 
        success: false, 
        error: 'Section not found' 
      };
    }

    // Get the current max version number for this section
    const { data: versions } = await supabase
      .from('playbook_section_versions')
      .select('version_number')
      .eq('section_id', sectionId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1;

    await supabase
      .from('playbook_section_versions')
      .insert({
        section_id: sectionId,
        company_id: section.company_id,
        version_number: nextVersion,
        title: section.title,
        content,
        status: section.status,
        progress_percentage: section.progress_percentage || 0,
        tags: section.tags || [],
        change_summary: versionNotes || 'Version created',
        changed_by: (await supabase.auth.getUser()).data.user?.id
      });

    return { success: true };
  } catch (error) {
    console.error('Error creating playbook version:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get playbook sections for a company
 */
export async function getPlaybookSections(companyId: string) {
  try {
    const { data, error } = await supabase
      .from('playbook_sections')
      .select(`
        *,
        profiles!playbook_sections_last_updated_by_fkey(first_name, last_name, email)
      `)
      .eq('company_id', companyId)
      .order('section_order', { ascending: true });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching playbook sections:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}

/**
 * Get playbook section versions
 */
export async function getPlaybookVersions(sectionId: string) {
  try {
    const { data, error } = await supabase
      .from('playbook_section_versions')
      .select(`
        *,
        profiles!playbook_section_versions_created_by_fkey(first_name, last_name, email)
      `)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching playbook versions:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}

/**
 * Get playbook activity for a section or company
 */
export async function getPlaybookActivity(sectionId?: string, companyId?: string) {
  try {
    let query = supabase
      .from('playbook_activity')
      .select(`
        *,
        profiles!playbook_activity_user_id_fkey(first_name, last_name, email),
        playbook_sections!playbook_activity_section_id_fkey(title)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (sectionId) {
      query = query.eq('section_id', sectionId);
    } else if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching playbook activity:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      data: []
    };
  }
}
