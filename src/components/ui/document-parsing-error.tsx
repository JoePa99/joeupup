import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentParsingErrorProps {
  errorMessage: string;
  attachmentName: string;
  attachmentPath: string;
  attachmentType: string;
  conversationId?: string;
  channelId?: string;
  agentId: string;
  onRetry?: () => void;
}

export function DocumentParsingError({
  errorMessage,
  attachmentName,
  attachmentPath,
  attachmentType,
  conversationId,
  channelId,
  agentId,
  onRetry
}: DocumentParsingErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Call chat-with-agent again with the same attachment
      const { data, error } = await supabase.functions.invoke('chat-with-agent', {
        body: {
          message: `Please analyze this document: ${attachmentName}`,
          agent_id: agentId,
          conversation_id: conversationId,
          channel_id: channelId,
          attachments: [{
            name: attachmentName,
            path: attachmentPath,
            type: attachmentType,
            size: 0 // Will be fetched by the function
          }]
        }
      });
      
      if (error) {
        console.error('Retry error:', error);
        toast.error('Retry failed. Please try again.');
      } else {
        toast.success('Document processing restarted');
        onRetry?.();
      }
    } catch (error) {
      console.error('Failed to retry:', error);
      toast.error('Failed to retry document parsing');
    } finally {
      setIsRetrying(false);
    }
  };
  
  return (
    <Alert variant="destructive" className="my-2">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Document Parsing Failed</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{errorMessage}</p>
        <p className="text-xs text-muted-foreground">
          Document: {attachmentName}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRetry}
          disabled={isRetrying}
          className="mt-2"
        >
          {isRetrying ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3 w-3" />
              Try Again
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
