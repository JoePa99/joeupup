import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Link as LinkIcon, FileText, Trash2, Loader2 } from "lucide-react";

export default function AgentDocuments() {
  const { workspaceId, agentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [agent, setAgent] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    if (agentId) {
      fetchAgent();
      fetchDocuments();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;
      setAgent(data);
    } catch (error: any) {
      console.error('Error fetching agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    try {
      // Read file content
      const text = await readFileAsText(uploadFile);

      // Generate embedding and save document
      await saveDocument(uploadFile.name, text, 'file_upload');

      setUploadFile(null);
      toast({
        title: "Document uploaded",
        description: "Processing and generating embeddings...",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading document",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;

    setUploading(true);
    try {
      // Scrape URL content (you'll need to implement this)
      const response = await fetch(urlInput);
      const text = await response.text();

      await saveDocument(urlInput, text, 'url_scrape');

      setUrlInput("");
      toast({
        title: "URL content imported",
        description: "Processing and generating embeddings...",
      });
    } catch (error: any) {
      toast({
        title: "Error scraping URL",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleTextUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput || !titleInput) return;

    setUploading(true);
    try {
      await saveDocument(titleInput, textInput, 'direct_input');

      setTextInput("");
      setTitleInput("");
      toast({
        title: "Document saved",
        description: "Processing and generating embeddings...",
      });
    } catch (error: any) {
      toast({
        title: "Error saving document",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const readFileAsText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const saveDocument = async (title: string, content: string, source: string) => {
    // Generate embedding
    const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke(
      'generate-embedding',
      { body: { text: content } }
    );

    if (embeddingError) throw embeddingError;

    // Save document
    const { error } = await supabase.from('agent_documents').insert({
      agent_id: agentId,
      company_id: workspaceId,
      title,
      content,
      embedding: embeddingData.embedding,
      source,
      chunk_index: 0,
      total_chunks: 1,
    });

    if (error) throw error;

    // Refresh documents list
    fetchDocuments();
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('agent_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast({
        title: "Document deleted",
      });

      fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Error deleting document",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents/${agentId}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agent
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Documents: {agent?.name}
          </h1>
          <p className="text-muted-foreground">
            Upload and manage documents for this agent
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Documents</CardTitle>
            <CardDescription>
              Add documents to enhance this agent's knowledge
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="file">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file">
                  <Upload className="w-4 h-4 mr-2" />
                  File Upload
                </TabsTrigger>
                <TabsTrigger value="url">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="text">
                  <FileText className="w-4 h-4 mr-2" />
                  Direct Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="file">Upload File (PDF, DOCX, TXT, MD)</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                    />
                  </div>
                  <Button type="submit" disabled={!uploadFile || uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="url">
                <form onSubmit={handleUrlUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="url">URL to Scrape</Label>
                    <Input
                      id="url"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/documentation"
                      disabled={uploading}
                    />
                  </div>
                  <Button type="submit" disabled={!urlInput || uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Scrape & Import
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="text">
                <form onSubmit={handleTextUpload} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Document Title</Label>
                    <Input
                      id="title"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="e.g., Product FAQ"
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="text">Content</Label>
                    <Textarea
                      id="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Paste your content here..."
                      rows={10}
                      disabled={uploading}
                    />
                  </div>
                  <Button type="submit" disabled={!titleInput || !textInput || uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Save Document
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No documents uploaded yet
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3 px-4 border rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString()} • {doc.source}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
