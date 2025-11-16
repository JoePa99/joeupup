import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, BookOpen, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface KnowledgeSourceSelectorProps {
  agent: {
    id: string;
    name: string;
  };
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CompanyDocument {
  id: string;
  name: string;
  doc_type: string;
  tags: string[] | null;
  playbook_section_id: string | null;
  created_at: string;
}

interface PlaybookSection {
  id: string;
  title: string;
  status: string;
}

export function KnowledgeSourceSelector({ agent, companyId, isOpen, onClose }: KnowledgeSourceSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const { data: documents = [], isLoading: documentsLoading } = useQuery<CompanyDocument[]>({
    queryKey: ['knowledge-documents', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_archives')
        .select('id, name, doc_type, tags, playbook_section_id, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as CompanyDocument[]) || [];
    },
    enabled: isOpen && !!companyId
  });

  const { data: playbookSections = [], isLoading: sectionsLoading } = useQuery<PlaybookSection[]>({
    queryKey: ['knowledge-playbook', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('playbook_sections')
        .select('id, title, status')
        .eq('company_id', companyId)
        .order('section_order', { ascending: true });

      if (error) throw error;
      return (data as PlaybookSection[]) || [];
    },
    enabled: isOpen && !!companyId
  });

  const { data: agentDocuments = [], isLoading: agentDocsLoading, refetch: refetchAgentDocs } = useQuery({
    queryKey: ['agent-knowledge-docs', agent.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('document_id')
        .eq('agent_id', agent.id);

      if (error) throw error;
      return data as { document_id: string }[];
    },
    enabled: isOpen
  });

  const assignedDocumentIds = useMemo(() => new Set(agentDocuments.map(doc => doc.document_id)), [agentDocuments]);

  const playbookWithCounts = useMemo(() => {
    return playbookSections.map(section => {
      const sectionDocs = documents.filter(doc => doc.playbook_section_id === section.id);
      const assigned = sectionDocs.filter(doc => assignedDocumentIds.has(doc.id));
      return {
        ...section,
        documents: sectionDocs,
        assignedCount: assigned.length
      };
    });
  }, [documents, playbookSections, assignedDocumentIds]);

  const handleDocumentToggle = async (documentId: string, isAssigned: boolean) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to update knowledge sources.',
        variant: 'destructive'
      });
      return;
    }

    setActiveDocumentId(documentId);
    try {
      if (isAssigned) {
        const { error } = await supabase.functions.invoke('remove-agent-document', {
          body: {
            agent_id: agent.id,
            document_id: documentId,
            user_id: user.id
          }
        });

        if (error) throw new Error(error.message);
        toast({ title: 'Document disconnected' });
      } else {
        const { error } = await supabase.functions.invoke('process-agent-documents', {
          body: {
            document_archive_id: documentId,
            agent_id: agent.id,
            company_id: companyId,
            user_id: user.id
          }
        });

        if (error) throw new Error(error.message);
        toast({ title: 'Document connected' });
      }

      refetchAgentDocs();
    } catch (error) {
      toast({
        title: 'Unable to update knowledge source',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive'
      });
    } finally {
      setActiveDocumentId(null);
    }
  };

  const handleSectionToggle = async (sectionId: string, fullyAssigned: boolean) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'You must be signed in to update knowledge sources.',
        variant: 'destructive'
      });
      return;
    }

    const section = playbookWithCounts.find(section => section.id === sectionId);
    if (!section) {
      toast({ title: 'Playbook section not found', variant: 'destructive' });
      return;
    }

    if (section.documents.length === 0) {
      toast({ title: 'No documents available for this section', variant: 'destructive' });
      return;
    }

    setActiveSectionId(sectionId);
    try {
      if (fullyAssigned) {
        await Promise.all(
          section.documents
            .filter(doc => assignedDocumentIds.has(doc.id))
            .map(async doc => {
              const { error } = await supabase.functions.invoke('remove-agent-document', {
                body: {
                  agent_id: agent.id,
                  document_id: doc.id,
                  user_id: user.id
                }
              });
              if (error) throw new Error(error.message);
            })
        );
        toast({ title: 'Playbook collection disconnected' });
      } else {
        await Promise.all(
          section.documents
            .filter(doc => !assignedDocumentIds.has(doc.id))
            .map(async doc => {
              const { error } = await supabase.functions.invoke('process-agent-documents', {
                body: {
                  document_archive_id: doc.id,
                  agent_id: agent.id,
                  company_id: companyId,
                  user_id: user.id
                }
              });
              if (error) throw new Error(error.message);
            })
        );
        toast({ title: 'Playbook collection connected' });
      }

      refetchAgentDocs();
    } catch (error) {
      toast({
        title: 'Unable to update playbook collection',
        description: error instanceof Error ? error.message : 'Unexpected error',
        variant: 'destructive'
      });
    } finally {
      setActiveSectionId(null);
    }
  };

  const loading = documentsLoading || sectionsLoading || agentDocsLoading;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Knowledge Sources for {agent.name}</DialogTitle>
          <DialogDescription>
            Connect documents and playbook collections to enhance this assistant's knowledge.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="documents" className="mt-2">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="playbook">Playbook Collections</TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="mt-4">
              <ScrollArea className="h-[420px] pr-4">
                {documents.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    No documents found for this company.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map(doc => {
                      const isAssigned = assignedDocumentIds.has(doc.id);
                      return (
                        <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium text-sm">{doc.name}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{doc.doc_type}</Badge>
                              {doc.tags?.map(tag => (
                                <Badge key={tag} variant="secondary">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isAssigned}
                              onCheckedChange={() => handleDocumentToggle(doc.id, isAssigned)}
                              disabled={!!activeDocumentId}
                            />
                            <Button
                              variant={isAssigned ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleDocumentToggle(doc.id, isAssigned)}
                              disabled={activeDocumentId === doc.id}
                            >
                              {activeDocumentId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isAssigned ? (
                                'Connected'
                              ) : (
                                'Connect'
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="playbook" className="mt-4">
              <ScrollArea className="h-[420px] pr-4">
                {playbookWithCounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-10">
                    No playbook collections found for this company.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playbookWithCounts.map(section => {
                      const fullyAssigned = section.assignedCount === section.documents.length && section.documents.length > 0;
                      return (
                        <div key={section.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium text-sm">{section.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {section.documents.length} document{section.documents.length === 1 ? '' : 's'} • {section.assignedCount} connected
                            </p>
                          </div>
                          <Button
                            variant={fullyAssigned ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => handleSectionToggle(section.id, fullyAssigned)}
                            disabled={activeSectionId === section.id}
                          >
                            {activeSectionId === section.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : fullyAssigned ? (
                              'Disconnect'
                            ) : (
                              'Connect'
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
