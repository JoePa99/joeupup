import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Eye,
  Edit3,
  Download,
  TrendingUp,
  Lightbulb,
  Target,
  BarChart3,
  CheckCircle2
} from "lucide-react";

interface DocumentAnalysisCardProps {
  analysis: {
    executiveSummary?: string;
    keyFindings?: string[];
    mainThemes?: string[];
    importantDataPoints?: string[];
    recommendations?: string[];
    documentType?: string;
    confidenceScore?: number;
  };
  documentName: string;
  aiProvider?: string;
  aiModel?: string;
  onViewFull?: () => void;
  onEdit?: () => void;
  onDownload?: () => void;
}

export function DocumentAnalysisCard({
  analysis,
  documentName,
  aiProvider,
  aiModel,
  onViewFull,
  onEdit,
  onDownload
}: DocumentAnalysisCardProps) {
  const confidencePercentage = Math.round((analysis.confidenceScore || 0) * 100);
  
  const getConfidenceBadgeVariant = (score: number) => {
    if (score >= 0.8) return "default";
    if (score >= 0.6) return "secondary";
    return "outline";
  };

  return (
    <Card className="w-full border-l-4 border-l-primary">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Document Analysis</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">{documentName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {analysis.confidenceScore !== undefined && (
              <Badge variant={getConfidenceBadgeVariant(analysis.confidenceScore)}>
                {confidencePercentage}% confidence
              </Badge>
            )}
            
            {analysis.documentType && (
              <Badge variant="outline">
                {analysis.documentType}
              </Badge>
            )}
          </div>
        </div>

        {/* AI Provider Info */}
        {(aiProvider || aiModel) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 flex-wrap">
            <span>Analyzed by</span>
            {aiProvider && (
              <Badge variant="secondary" className="text-xs">
                {aiProvider === 'google' ? 'Gemini' : aiProvider === 'anthropic' ? 'Claude' : 'OpenAI'}
              </Badge>
            )}
            {aiModel && (
              <span className="text-xs truncate max-w-[70vw] sm:max-w-none">({aiModel})</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Executive Summary */}
        {analysis.executiveSummary && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm leading-relaxed">{analysis.executiveSummary}</p>
          </div>
        )}

        {/* Key Findings */}
        {analysis.keyFindings && analysis.keyFindings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Key Findings</h4>
            </div>
            <ul className="space-y-1 ml-6">
              {analysis.keyFindings.slice(0, 3).map((finding, index) => (
                <li key={index} className="text-sm text-muted-foreground list-disc">
                  {finding}
                </li>
              ))}
              {analysis.keyFindings.length > 3 && (
                <li className="text-sm text-muted-foreground italic">
                  +{analysis.keyFindings.length - 3} more findings...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Main Themes */}
        {analysis.mainThemes && analysis.mainThemes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Main Themes</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.mainThemes.slice(0, 4).map((theme, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {theme}
                </Badge>
              ))}
              {analysis.mainThemes.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{analysis.mainThemes.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Important Data Points */}
        {analysis.importantDataPoints && analysis.importantDataPoints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Important Data Points</h4>
            </div>
            <ul className="space-y-1 ml-6">
              {analysis.importantDataPoints.slice(0, 2).map((dataPoint, index) => (
                <li key={index} className="text-sm text-muted-foreground list-disc">
                  {dataPoint}
                </li>
              ))}
              {analysis.importantDataPoints.length > 2 && (
                <li className="text-sm text-muted-foreground italic">
                  +{analysis.importantDataPoints.length - 2} more data points...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Recommendations</h4>
            </div>
            <ul className="space-y-1 ml-6">
              {analysis.recommendations.slice(0, 2).map((recommendation, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 mt-1 flex-shrink-0" />
                  <span>{recommendation}</span>
                </li>
              ))}
              {analysis.recommendations.length > 2 && (
                <li className="text-sm text-muted-foreground italic ml-5">
                  +{analysis.recommendations.length - 2} more recommendations...
                </li>
              )}
            </ul>
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-start sm:justify-end gap-2 gap-y-2 flex-wrap sm:flex-nowrap pt-2">
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="gap-2 w-full sm:w-auto"
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
          )}
          
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2 w-full sm:w-auto"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </Button>
          )}
          
          {onViewFull && (
            <Button
              variant="default"
              size="sm"
              onClick={onViewFull}
              className="gap-2 w-full sm:w-auto"
            >
              <Eye className="h-3 w-3" />
              View Full Analysis
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

