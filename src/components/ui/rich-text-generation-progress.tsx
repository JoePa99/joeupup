import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RichTextGenerationProgressProps {
  progress: number;
  estimatedTime?: string;
  status?: string;
  isCollapsible?: boolean;
}

export function RichTextGenerationProgress({ 
  progress, 
  estimatedTime = "6 Min", 
  status = "Generating content...",
  isCollapsible = true 
}: RichTextGenerationProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  useEffect(() => {
    // If stuck at 100% for more than 2 minutes, show timeout warning
    if (progress === 100) {
      const timer = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, 120000); // 2 minutes
      
      return () => clearTimeout(timer);
    } else {
      setShowTimeoutWarning(false);
    }
  }, [progress]);

  return (
    <div className="bg-white border border-border rounded-[6px] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isCollapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0 h-auto"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">Generating Response</p>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-primary">{progress}% Completed</p>
            <p className="text-xs text-muted-foreground">{estimatedTime}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-3">
        <Progress value={progress} className="w-full" />
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Document Analysis</span>
              <span className={progress >= 25 ? "text-green-600" : ""}>
                {progress >= 25 ? "✓" : "⏳"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Content Generation</span>
              <span className={progress >= 50 ? "text-green-600" : ""}>
                {progress >= 50 ? "✓" : "⏳"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Formatting & Review</span>
              <span className={progress >= 75 ? "text-green-600" : ""}>
                {progress >= 75 ? "✓" : "⏳"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Finalization</span>
              <span className={progress >= 100 ? "text-green-600" : ""}>
                {progress >= 100 ? "✓" : "⏳"}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {showTimeoutWarning && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This is taking longer than expected. The operation might have timed out. 
            Try refreshing the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}