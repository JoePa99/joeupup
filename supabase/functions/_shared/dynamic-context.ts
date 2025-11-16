import { generateQueryEmbedding } from './embedding-config.ts'

type SupabaseClient = {
  from: (table: string) => any
  rpc: (fn: string, args: Record<string, any>) => Promise<{ data: any; error: any }>
  functions: { invoke: (fn: string, options: { body?: any }) => Promise<{ data: any; error: any }> }
}

interface BuildDynamicContextOptions {
  supabaseClient: SupabaseClient
  companyId?: string | null
  agentId: string
  queries: string[]
  baseQuery: string
  openaiApiKey: string
}

interface DynamicContextResult {
  tieredContext: string
  attachmentSource?: {
    bucket?: string
    filePath?: string
    fileName?: string
    fileType?: string
  }
  contextUsed: boolean
}

interface ExpandedQueryResult {
  original: string
  expanded?: string[]
}

const MAX_DOCUMENTS = 5
const MAX_DOCUMENT_LENGTH = 12000
const MAX_PLAYBOOK_SNIPPET = 600

function sanitizeQuery(value: string) {
  return value.replace(/[%_]/g, match => `\\${match}`)
}

function formatDocumentContent(doc: any) {
  const content = doc.content || ''
  if (!content) return ''
  if (content.length <= MAX_DOCUMENT_LENGTH) return content
  return `${content.substring(0, MAX_DOCUMENT_LENGTH)}…`
}

function formatPlaybookEntry(entry: any) {
  const sections: string[] = []
  sections.push(`Title: ${entry.title || 'Untitled Entry'}`)
  if (entry.section_tag) sections.push(`Section: ${entry.section_tag}`)
  if (entry.status) sections.push(`Status: ${entry.status}`)
  if (entry.tags?.length) sections.push(`Tags: ${entry.tags.join(', ')}`)
  const source = entry.summary || entry.description || entry.content_markdown || ''
  if (source) {
    const trimmed = source.trim()
    const snippet = trimmed.length > MAX_PLAYBOOK_SNIPPET
      ? `${trimmed.substring(0, MAX_PLAYBOOK_SNIPPET)}…`
      : trimmed
    if (snippet) sections.push(`Content: ${snippet}`)
  }
  return sections.join('\n')
}

export function parseUserQuery(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

export async function expandQuery(query: string, openaiApiKey: string): Promise<ExpandedQueryResult> {
  const original = parseUserQuery(query)
  if (!original) {
    return { original: '' }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You expand user search queries into up to three concise variations. Return them as a JSON array of strings.'
          },
          {
            role: 'user',
            content: `Expand this query for document search: ${original}`
          }
        ],
        max_tokens: 150,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI query expansion failed: ${response.status}`)
    }

    const data = await response.json()
    const text: string = data?.choices?.[0]?.message?.content || ''
    let expanded: string[] = []

    try {
      expanded = JSON.parse(text)
      if (!Array.isArray(expanded)) {
        expanded = []
      }
    } catch (_err) {
      expanded = text
        .split(/\n|,/)
        .map((entry: string) => entry.trim())
        .filter(Boolean)
        .slice(0, 3)
    }

    return { original, expanded }
  } catch (error) {
    console.error('Failed to expand query, falling back to original:', error)
    return { original, expanded: [] }
  }
}

async function fetchCompanyOSContext(supabaseClient: SupabaseClient, companyId?: string | null) {
  if (!companyId) return ''

  const { data, error } = await supabaseClient
    .from('company_os')
    .select('os_data, metadata')
    .eq('company_id', companyId)
    .single()

  if (error || !data?.os_data) {
    return ''
  }

  try {
    const osData = data.os_data
    const core = osData?.coreIdentityAndStrategicFoundation
    const market = osData?.customerAndMarketContext
    const brand = osData?.brandVoiceAndExpression

    if (!core || !market || !brand) {
      return ''
    }

    const mission = core.missionAndVision?.missionStatement
    const vision = core.missionAndVision?.visionStatement
    const values = Array.isArray(core.coreValues) ? core.coreValues.join(', ') : ''
    const positioning = core.positioningStatement

    return `## CompanyOS Snapshot\n` +
      `${core.companyOverview || ''}\n\n` +
      (mission ? `Mission: ${mission}\n` : '') +
      (vision ? `Vision: ${vision}\n` : '') +
      (values ? `Values: ${values}\n` : '') +
      (positioning ? `Positioning: ${positioning.uniqueBenefit || ''} for ${positioning.targetSegment || ''}\n` : '') +
      (market?.customerJourney?.topPainPoints ? `Pain Points: ${market.customerJourney.topPainPoints.join('; ')}\n` : '') +
      (market?.valuePropositions ? `Value Props: ${market.valuePropositions.map((vp: any) => `${vp.clientType}: ${vp.value}`).join(' | ')}\n` : '')
  } catch (err) {
    console.error('Failed to format CompanyOS context:', err)
    return ''
  }
}

async function fetchDocumentContext(options: BuildDynamicContextOptions & { companyMetadata?: any }) {
  const { supabaseClient, companyId, agentId, queries, openaiApiKey } = options
  if (!companyId) {
    return { sections: [], attachmentSource: undefined }
  }

  const dedupedQueries = Array.from(new Set(queries.filter(Boolean))).slice(0, 3)
  const seenDocuments = new Set<string>()
  const sections: string[] = []

  for (const query of dedupedQueries) {
    try {
      const embedding = await generateQueryEmbedding(query, openaiApiKey)
      const { data, error } = await supabaseClient.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.25,
        match_count: MAX_DOCUMENTS,
        p_company_id: companyId,
        p_agent_id: agentId
      })

      if (error) {
        console.error('Document search error:', error)
        continue
      }

      if (!data?.length) {
        continue
      }

      for (const doc of data) {
        const docKey = `${doc.id}`
        if (seenDocuments.has(docKey)) continue
        seenDocuments.add(docKey)
        sections.push([
          `Document: ${doc.file_name || 'Unknown'}`,
          `Similarity: ${doc.similarity?.toFixed ? doc.similarity.toFixed(3) : doc.similarity}`,
          `Content: ${formatDocumentContent(doc)}`
        ].join('\n'))
      }
    } catch (err) {
      console.error('Failed to run document search:', err)
    }
  }

  return { sections, attachmentSource: undefined }
}

async function fetchGoogleDriveContext(supabaseClient: SupabaseClient, companyId?: string | null, query?: string) {
  if (!companyId || !query) return []

  try {
    const { data: companyData, error } = await supabaseClient
      .from('companies')
      .select('google_drive_folder_id, google_drive_folder_name')
      .eq('id', companyId)
      .single()

    if (error || !companyData?.google_drive_folder_id) {
      return []
    }

    const { data: searchResults } = await supabaseClient.functions.invoke('search-google-drive-files', {
      body: {
        query,
        folderId: companyData.google_drive_folder_id,
        maxResults: 5
      }
    })

    if (!searchResults?.files?.length) {
      return []
    }

    const files = searchResults.files.slice(0, 3)
    const sections: string[] = []

    for (const file of files) {
      try {
        const { data: fileContent } = await supabaseClient.functions.invoke('fetch-google-drive-file-content', {
          body: {
            fileId: file.id,
            mimeType: file.mimeType,
            fileName: file.name
          }
        })

        if (fileContent?.success && fileContent?.content) {
          sections.push([
            `Document: ${file.name}`,
            `Link: ${file.webViewLink || 'N/A'}`,
            `Content: ${fileContent.content}`
          ].join('\n'))
        }
      } catch (err) {
        console.error('Failed to read Google Drive file content:', err)
      }
    }

    return sections
  } catch (err) {
    console.error('Google Drive context failed:', err)
    return []
  }
}

async function fetchPlaybookContext(supabaseClient: SupabaseClient, companyId?: string | null, query?: string) {
  if (!companyId) return []

  try {
    let builder = supabaseClient
      .from('playbook_entries')
      .select('id, title, description, summary, status, tags, section_tag, content_markdown')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(3)

    if (query) {
      const escaped = sanitizeQuery(query)
      builder = builder.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%,content_markdown.ilike.%${escaped}%`)
    }

    const { data, error } = await builder

    if (error || !data?.length) {
      return []
    }

    return data.map(formatPlaybookEntry)
  } catch (err) {
    console.error('Playbook context lookup failed:', err)
    return []
  }
}

export async function buildDynamicContext(options: BuildDynamicContextOptions): Promise<DynamicContextResult> {
  const { supabaseClient, companyId, queries, baseQuery } = options
  if (!companyId) {
    return { tieredContext: '', contextUsed: false }
  }

  const sections: string[] = []
  const companyOS = await fetchCompanyOSContext(supabaseClient, companyId)
  if (companyOS) {
    sections.push(companyOS)
  }

  const documentContext = await fetchDocumentContext(options)
  if (documentContext.sections.length) {
    sections.push('## Internal Documents\n' + documentContext.sections.join('\n\n---\n\n'))
  }

  const googleDriveSections = await fetchGoogleDriveContext(supabaseClient, companyId, baseQuery)
  if (googleDriveSections.length) {
    sections.push('## Google Drive References\n' + googleDriveSections.join('\n\n---\n\n'))
  }

  const playbookSections = await fetchPlaybookContext(supabaseClient, companyId, baseQuery)
  if (playbookSections.length) {
    sections.push('## Playbook Procedures\n' + playbookSections.join('\n\n---\n\n'))
  }

  return {
    tieredContext: sections.join('\n\n'),
    attachmentSource: documentContext.attachmentSource,
    contextUsed: sections.length > 0
  }
}

interface BuildAssistantPromptOptions {
  agent: {
    displayName?: string | null
    personaInstructions?: string | null
    responseStructure?: string | null
    specialtyLabel?: string | null
    role?: string | null
    description?: string | null
  }
  context?: string
  userQuery: string
  toolContext?: string
}

export function buildAssistantPrompt({ agent, context, userQuery, toolContext }: BuildAssistantPromptOptions) {
  const persona = agent.personaInstructions?.trim() || 'You are a helpful, detail-oriented assistant.'
  const responseStructure = agent.responseStructure?.trim() || 'Respond with clear, structured reasoning followed by concise next steps.'
  const specialty = agent.specialtyLabel ? `Focus Area: ${agent.specialtyLabel}\n` : ''
  const roleLine = agent.description ? `${agent.description}\n` : ''

  let prompt = `You are ${agent.displayName || 'CompanyOS Assistant'}.\n${roleLine}${specialty}${persona}\n\n`

  if (context) {
    prompt += `# COMPANY KNOWLEDGE\n${context}\n\n`
  }

  if (toolContext) {
    prompt += `# TOOL OUTPUT\n${toolContext}\n\n`
  }

  prompt += `# TASK\nThe user asked: "${userQuery}"\n${responseStructure}`
  return prompt
}
