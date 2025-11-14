import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyDocumentsList } from "./CompanyDocumentsList";
import { DocumentUploadArea } from "./DocumentUploadArea";
import { useState } from "react";

interface AgentDocumentsSidebarProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentDocumentsSidebar({
  agentId,
  isOpen,
  onClose
}: AgentDocumentsSidebarProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDocumentsUploaded = () => {
    // Trigger refresh of the documents list
    setRefreshTrigger(prev => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="w-full sm:w-96 md:w-[420px] lg:w-[480px] shrink-0 bg-card border-l border-border h-full max-h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 py-4 sm:py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="font-semibold text-sm sm:text-base truncate">Agent Knowledge Base</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scroll-smooth">
        <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* Document Upload Area */}
          <DocumentUploadArea agentId={agentId} onUploadComplete={handleDocumentsUploaded} />
          
          {/* Divider */}
          <div className="border-t border-border" />
          
          {/* Company Documents List */}
          <CompanyDocumentsList 
            key={refreshTrigger}
            agentId={agentId} 
            onDocumentsUploaded={handleDocumentsUploaded} 
          />
        </div>
      </div>

      
    </div>
  );
}