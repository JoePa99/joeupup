import { Progress } from "@/components/ui/progress";
import { FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PDFExtractionProgressProps {
  currentPage: number;
  totalPages: number;
  status?: string;
}

export function PDFExtractionProgress({ 
  currentPage, 
  totalPages,
  status = "Extracting PDF text..."
}: PDFExtractionProgressProps) {
  const progressPercentage = totalPages > 0 
    ? Math.round((currentPage / totalPages) * 100) 
    : 0;

  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <FileText className="h-5 w-5 text-primary" />
              <Loader2 className="h-3 w-3 text-primary animate-spin absolute -top-1 -right-1" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Extracting PDF</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-primary">
              Page {currentPage} of {totalPages}
            </p>
            <p className="text-xs text-muted-foreground">
              {progressPercentage}% Complete
            </p>
          </div>
        </div>
        
        <Progress value={progressPercentage} className="w-full h-2" />
      </CardContent>
    </Card>
  );
}

