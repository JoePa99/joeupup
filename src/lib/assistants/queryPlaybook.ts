export interface PlaybookEntryResult {
  id: string
  title: string | null
  description: string | null
  summary: string | null
  status: string | null
  tags: string[] | null
  section_tag: string | null
  content_markdown: string | null
  updated_at: string | null
  created_at: string
  is_published: boolean | null
}

interface PlaybookQueryOptions {
  supabaseClient: {
    from: (table: string) => any
  }
  companyId: string
  query: string
  limit?: number
}

const MAX_SNIPPET_LENGTH = 600

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, match => `\\${match}`)
}

function buildSnippet(entry: PlaybookEntryResult) {
  const source = entry.summary || entry.description || entry.content_markdown || ''
  if (!source) return ''
  const trimmed = source.trim()
  if (trimmed.length <= MAX_SNIPPET_LENGTH) return trimmed
  return `${trimmed.substring(0, MAX_SNIPPET_LENGTH)}…`
}

export async function queryPlaybookEntries({
  supabaseClient,
  companyId,
  query,
  limit = 3
}: PlaybookQueryOptions): Promise<PlaybookEntryResult[]> {
  const sanitizedQuery = query.trim()
  let builder = supabaseClient
    .from('playbook_entries')
    .select('id, title, description, summary, status, tags, section_tag, content_markdown, updated_at, created_at, is_published')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (sanitizedQuery) {
    const escaped = escapeIlike(sanitizedQuery)
    builder = builder.or(
      `title.ilike.%${escaped}%,description.ilike.%${escaped}%,content_markdown.ilike.%${escaped}%`
    )
  }

  const { data, error } = await builder

  if (error) {
    console.error('Error querying playbook entries:', error)
    return []
  }

  return data || []
}

export function formatPlaybookResults(entries: PlaybookEntryResult[]): string {
  if (!entries.length) return ''

  return entries
    .map(entry => {
      const sections: string[] = [
        'Source: Playbook Entry',
        `Title: ${entry.title || 'Untitled Entry'}`,
      ]

      if (entry.section_tag) {
        sections.push(`Section: ${entry.section_tag}`)
      }
      if (entry.status) {
        sections.push(`Status: ${entry.status}`)
      }
      if (entry.tags && entry.tags.length > 0) {
        sections.push(`Tags: ${entry.tags.join(', ')}`)
      }

      const snippet = buildSnippet(entry)
      if (snippet) {
        sections.push(`Content: ${snippet}`)
      }

      return sections.join('\n')
    })
    .join('\n\n---\n\n')
}
