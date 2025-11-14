import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { processDocumentForEmbeddings, getDocumentProcessingStats } from '@/lib/document-processing';
import { toast } from 'sonner';
import { Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';

export function DocumentProcessingTest() {
  const { user } = useAuth();
  const [documentArchiveId, setDocumentArchiveId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ total: number; processed: number; pending: number } | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleProcessDocument = async () => {
    if (!documentArchiveId || !companyId || !user?.id) {
      toast.error('Please fill in all fields and ensure you are logged in');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processDocumentForEmbeddings(documentArchiveId, companyId, user.id);
      setLastResult(result);
      
      if (result.success) {
        toast.success('Document processed successfully!');
      } else {
        toast.error(`Processing failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGetStats = async () => {
    if (!companyId) {
      toast.error('Please enter a company ID');
      return;
    }

    try {
      const statsData = await getDocumentProcessingStats(companyId);
      setStats(statsData);
    } catch (error: any) {
      toast.error(`Error fetching stats: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Document Processing Test</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-id">Document Archive ID</Label>
              <Input
                id="document-id"
                value={documentArchiveId}
                onChange={(e) => setDocumentArchiveId(e.target.value)}
                placeholder="Enter document archive ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-id">Company ID</Label>
              <Input
                id="company-id"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="Enter company ID"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={handleProcessDocument} 
              disabled={isProcessing || !documentArchiveId || !companyId || !user?.id}
              className="flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Process Document</span>
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleGetStats} 
              variant="outline"
              disabled={!companyId}
            >
              Get Stats
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Display */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Documents</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Result Display */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {lastResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <span>Last Processing Result</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Status:</span>
                <span className={lastResult.success ? 'text-green-600' : 'text-red-600'}>
                  {lastResult.success ? 'Success' : 'Failed'}
                </span>
              </div>
              <div>
                <span className="font-medium">Message:</span> {lastResult.message}
              </div>
              {lastResult.error && (
                <div>
                  <span className="font-medium">Error:</span> {lastResult.error}
                </div>
              )}
              {lastResult.data && (
                <div className="space-y-1">
                  <div><span className="font-medium">Document ID:</span> {lastResult.data.document_id}</div>
                  <div><span className="font-medium">Content Length:</span> {lastResult.data.content_length}</div>
                  <div><span className="font-medium">Embedding Dimensions:</span> {lastResult.data.embedding_dimensions}</div>
                  <div><span className="font-medium">Filename:</span> {lastResult.data.filename}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="font-medium">User ID:</span> {user?.id || 'Not logged in'}
            </div>
            <div>
              <span className="font-medium">Email:</span> {user?.email || 'N/A'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




