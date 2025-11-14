import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink, 
  Copy, 
  BookOpen,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Quote
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseMarkdown } from "@/lib/markdown";

interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  relevance_score: number;
  accessed_at: string;
}

interface ResearchSection {
  title: string;
  content: string;
  key_points: string[];
  sources?: ResearchSource[];
}

interface WebResearchData {
  query: string;
  summary: string;
  sections: ResearchSection[];
  key_insights: string[];
  confidence_score: number;
  total_sources: number;
  sources?: ResearchSource[];
}

interface WebResearchMetadata {
  depth: string;
  focus_areas: string[];
  generated_at: string;
  execution_time: number;
  model: string;
}

interface WebResearchCardProps {
  research: WebResearchData;
  metadata: WebResearchMetadata;
}

export function WebResearchCard({ research, metadata }: WebResearchCardProps) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // First section expanded by default
  const [showAllInsights, setShowAllInsights] = useState(false);

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const handleCopyContent = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Content Copied",
      description: `${type} has been copied to your clipboard.`,
    });
  };

  const handleCopyAllResearch = () => {
    const fullContent = [
      `Research Query: ${research.query}`,
      `\nSummary:\n${research.summary}`,
      ...research.sections.map(section => 
        `\n## ${section.title}\n${section.content}\n\nKey Points:\n${section.key_points.map(point => `• ${point}`).join('\n')}`
      ),
      `\nKey Insights:\n${research.key_insights.map(insight => `• ${insight}`).join('\n')}`
    ].join('\n');

    navigator.clipboard.writeText(fullContent);
    toast({
      title: "Research Copied",
      description: "The complete research has been copied to your clipboard.",
    });
  };

  const formatExecutionTime = (ms: number) => {
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 0.6) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircle2 className="h-3 w-3" />;
    if (score >= 0.6) return <AlertCircle className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  const getDepthBadgeColor = (depth: string) => {
    switch (depth) {
      case 'comprehensive': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'detailed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quick': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="space-y-4 p-0 max-w-full overflow-hidden">
        {/* Summary */}
        <div className="">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
              <BookOpen className="h-5 w-5 text-black" />
              Executive Summary
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopyContent(research.summary, 'Summary')}
              className="h-7 w-7 p-0 text-foreground hover:bg-muted/20 rounded"
            >
              <Copy className="h-3 w-3 text-black" />
            </Button>
          </div>
          <div 
            className="text-sm text-foreground leading-relaxed prose prose-sm max-w-full break-words hyphens-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:overflow-x-auto prose-code:break-words prose-p:break-words"
            dangerouslySetInnerHTML={{ 
              __html: parseMarkdown(
                research.summary,
                (research.sources && research.sources.length > 0)
                  ? research.sources
                  : research.sections.flatMap(s => s.sources || [])
              ).html 
            }}
          />
        </div>
        <Separator className="my-2" />

        {/* Key Insights */}
        {research.key_insights.length > 0 && (
          <div className="">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <TrendingUp className="h-5 w-5 text-black" />
                Key Insights
              </h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopyContent(research.key_insights.join('\n• '), 'Key insights')}
                className="h-7 w-7 p-0 text-foreground hover:bg-muted/20 rounded"
              >
                <Copy className="h-3 w-3 text-black" />
              </Button>
            </div>
            <div className="space-y-3 max-w-full overflow-hidden">
              {research.key_insights.slice(0, showAllInsights ? undefined : 3).map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-0 max-w-full overflow-hidden">
                  <div className="w-2 h-2 rounded-full bg-black mt-1.5 flex-shrink-0" />
                   <div 
                     className="text-sm text-foreground prose prose-sm max-w-full break-words hyphens-auto flex-1 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:overflow-x-auto prose-code:break-words prose-p:break-words"
                     dangerouslySetInnerHTML={{ 
                       __html: parseMarkdown(
                         insight,
                         (research.sources && research.sources.length > 0)
                           ? research.sources
                           : research.sections.flatMap(s => s.sources || [])
                       ).html 
                     }}
                   />
                </div>
              ))}
              {research.key_insights.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllInsights(!showAllInsights)}
                  className="text-foreground hover:bg-muted/20 p-0 h-auto flex items-center gap-1"
                >
                  {showAllInsights ? (
                    <>
                      Show less
                      <ChevronDown className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Show {research.key_insights.length - 3} more insights
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {research.key_insights.length > 0 && <Separator className="my-2" />}

        {/* Research Sections */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <div className="w-1 h-4 bg-black rounded-full"></div>
            Detailed Research
          </h4>
          {research.sections.map((section, index) => (
            <Collapsible
              key={index}
              open={expandedSections.has(index)}
              onOpenChange={() => toggleSection(index)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto hover:bg-muted/20 transition"
                >
                  <span className="font-semibold text-left text-foreground">{section.title}</span>
                  {expandedSections.has(index) ? (
                    <ChevronDown className="h-5 w-5 text-black" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-black" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-3">
                <div className="space-y-4 max-w-full overflow-hidden">
                  {/* Section Content */}
                  <div className="space-y-3 max-w-full overflow-hidden">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-semibold text-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-black"></div>
                        Content
                      </h5>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyContent(section.content, `Section: ${section.title}`)}
                        className="h-7 w-7 p-0 text-foreground hover:bg-muted/20 rounded"
                      >
                        <Copy className="h-3 w-3 text-black" />
                      </Button>
                    </div>
                     <div 
                       className="research-content text-sm text-foreground leading-[1.75] max-w-full"
                       style={{
                         wordBreak: 'break-word',
                         overflowWrap: 'break-word',
                         hyphens: 'auto'
                       }}
                       dangerouslySetInnerHTML={{ 
                         __html: parseMarkdown(
                           section.content,
                           (research.sources && research.sources.length > 0)
                             ? research.sources
                             : section.sources || []
                         ).html 
                       }}
                     />
                  </div>

                  {/* Key Points */}
                  {section.key_points.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h5 className="font-semibold text-foreground flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-black"></div>
                          Key Points
                        </h5>
                        <ul className="space-y-2 max-w-full overflow-hidden">
                          {section.key_points.map((point, pointIndex) => (
                            <li key={pointIndex} className="flex items-start gap-3 p-0 max-w-full overflow-hidden">
                              <div className="w-1.5 h-1.5 rounded-full bg-black mt-2 flex-shrink-0" />
                               <div 
                                 className="text-sm text-foreground prose prose-sm max-w-full break-words hyphens-auto flex-1 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:overflow-x-auto prose-code:break-words prose-p:break-words"
                                 dangerouslySetInnerHTML={{ 
                                   __html: parseMarkdown(
                                     point,
                                     (research.sources && research.sources.length > 0)
                                       ? research.sources
                                       : section.sources || []
                                   ).html 
                                 }}
                               />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Sources */}
                  {section.sources && section.sources.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h5 className="font-semibold text-foreground flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 text-black" />
                          Sources
                        </h5>
                        <div className="grid gap-3 max-w-full overflow-hidden">
                          {section.sources.map((source, sourceIndex) => (
                            <div key={sourceIndex} className="max-w-full overflow-hidden">
                              <div className="flex items-start justify-between gap-3 max-w-full overflow-hidden">
                                <div className="flex-1 space-y-1 max-w-full overflow-hidden">
                                   <div className="flex items-center gap-2 mb-1 max-w-full overflow-hidden">
                                     <h6 className="font-semibold text-sm text-foreground break-words hyphens-auto">
                                       {source.title}
                                     </h6>
                                   </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed break-words hyphens-auto">
                                    {source.snippet}
                                  </p>
                                  <div className="flex items-center gap-3 pt-1">
                                    <a
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-foreground flex items-center gap-1 font-medium hover:underline break-all"
                                    >
                                      <ExternalLink className="h-3 w-3 text-black" />
                                      Visit source
                                    </a>
                                    <span className="text-xs text-muted-foreground">
                                      • {formatDate(source.accessed_at)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Separator className="my-2" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
