import { marked } from 'marked';

/**
 * Check if content is already HTML or if it's markdown
 */
export const isHtml = (content: string): boolean => {
  // Simple check for HTML tags
  return /<[a-z][\s\S]*>/i.test(content);
};

/**
 * Normalize whitespace in content to prevent excessive line breaks
 */
const normalizeWhitespace = (content: string): string => {
  return content
    // Replace multiple consecutive line breaks with maximum of 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing spaces at end of lines
    .replace(/ +$/gm, '')
    // Normalize spaces around list items
    .replace(/\n\s*-\s+/g, '\n- ')
    .replace(/\n\s*\*\s+/g, '\n* ')
    .replace(/\n\s*\d+\.\s+/g, (match) => {
      const number = match.match(/\d+/)?.[0];
      return `\n${number}. `;
    })
    .trim();
};

/**
 * Convert markdown to HTML with controlled line break handling
 */
export const mdToHtml = (markdown: string): string => {
  if (isHtml(markdown)) {
    return markdown; // Already HTML, return as-is
  }
  
  // Normalize whitespace first
  const normalizedMarkdown = normalizeWhitespace(markdown);
  
  // Configure marked for controlled rendering
  marked.setOptions({
    breaks: false, // Don't automatically convert all line breaks to <br>
    gfm: true, // GitHub Flavored Markdown
  });
  
  const html = marked(normalizedMarkdown) as string;
  
  // Post-process HTML to clean up excessive spacing
  return html
    // Remove empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    // Normalize multiple <br> tags
    .replace(/(<br\s*\/?>){3,}/g, '<br><br>')
    // Clean up whitespace around list items
    .replace(/\s*<li>/g, '<li>')
    .replace(/<\/li>\s*/g, '</li>')
    .trim();
};

interface SourceCitation {
  index: number;
  url?: string;
  title?: string;
}

/**
 * Parse markdown content and extract source citations with enhanced formatting
 */
export const parseMarkdown = (content: string, sources?: any[]): { 
  html: string; 
  citations: SourceCitation[] 
} => {
  const citations: SourceCitation[] = [];
  
  // First, extract and track citations
  // Support both [Source N] and numeric [N]
  const citationRegex = /\[(?:Source\s+)?(\d+)\]/gi;
  let match;
  
  while ((match = citationRegex.exec(content)) !== null) {
    const sourceIndex = parseInt(match[1]) - 1; // Convert to 0-based index
    const source = sources?.[sourceIndex];
    
    if (!citations.find(c => c.index === sourceIndex)) {
      citations.push({
        index: sourceIndex,
        url: source?.url,
        title: source?.title
      });
    }
  }
  
  // Replace citations with enhanced clickable links
  let processedContent = content.replace(citationRegex, (match, sourceNum) => {
    const sourceIndex = parseInt(sourceNum) - 1;
    const source = sources?.[sourceIndex];
    
    if (source?.url) {
      return `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="citation-link inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md hover:bg-primary/20 transition-all font-semibold no-underline hover:shadow-sm" title="${source.title || 'View source'}">[${sourceNum}]<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`;
    }
    
    return `<span class="inline-flex items-center text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-semibold">[${sourceNum}]</span>`;
  });
  
  // Enhance bullet points formatting
  processedContent = processedContent
    // Convert • to proper list items
    .replace(/\n•\s+/g, '\n- ')
    // Ensure proper spacing around lists
    .replace(/([^\n])\n-\s/g, '$1\n\n- ')
    // Add spacing after list blocks
    .replace(/(\n-\s[^\n]+)\n([^\n-])/g, '$1\n\n$2');
  
  // Convert markdown to HTML
  const html = mdToHtml(processedContent);
  
  // Post-process HTML for better formatting
  const enhancedHtml = html
    // Add better spacing for paragraphs
    .replace(/<p>/g, '<p class="mb-4 leading-relaxed">')
    // Style lists better
    .replace(/<ul>/g, '<ul class="space-y-2 my-4 ml-4">')
    .replace(/<ol>/g, '<ol class="space-y-2 my-4 ml-4 list-decimal">')
    .replace(/<li>/g, '<li class="leading-relaxed">')
    // Style headings
    .replace(/<h3>/g, '<h3 class="text-lg font-semibold mt-6 mb-3">')
    .replace(/<h4>/g, '<h4 class="text-base font-semibold mt-4 mb-2">')
    // Style code blocks
    .replace(/<pre>/g, '<pre class="bg-muted p-3 rounded-md overflow-x-auto my-4">')
    .replace(/<code>/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">')
    // Style blockquotes
    .replace(/<blockquote>/g, '<blockquote class="border-l-4 border-primary/30 pl-4 italic my-4 text-muted-foreground">');
  
  return { html: enhancedHtml, citations };
};