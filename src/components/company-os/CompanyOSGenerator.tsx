import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Globe, Building2, Upload, FileText, X } from 'lucide-react';
import { generateCompanyOS, generateCompanyOSFromDocument } from '@/lib/company-os';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CompanyOS } from '@/types/company-os';
import { extractTextFromPDF } from '@/lib/pdf-extraction';
import { PDFExtractionProgress } from './PDFExtractionProgress';

interface CompanyOSGeneratorProps {
  companyId: string;
  companyName?: string;
  onGenerated: (companyOS: CompanyOS) => void;
}

export function CompanyOSGenerator({ companyId, companyName, onGenerated }: CompanyOSGeneratorProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [generationStep, setGenerationStep] = useState<'uploading' | 'extracting' | 'generating' | null>(null);
  const [pdfExtractionProgress, setPdfExtractionProgress] = useState<{ currentPage: number; totalPages: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    companyName: companyName || '',
    industry: '',
    websiteUrl: '',
    specificContext: ''
  });
  const [documentContext, setDocumentContext] = useState('');

  const handleGenerate = async () => {
    if (!formData.companyName.trim()) {
      toast({
        title: 'Company name required',
        description: 'Please enter your company name to generate CompanyOS',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { success, companyOS, error } = await generateCompanyOS({
        companyId,
        companyName: formData.companyName,
        industry: formData.industry || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        specificContext: formData.specificContext || undefined
      });

      if (!success || !companyOS) {
        throw new Error(error || 'Failed to generate CompanyOS');
      }

      toast({
        title: 'CompanyOS Generated!',
        description: 'Your company operating system has been created successfully.',
      });

      onGenerated(companyOS);
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - only PDF allowed
    const validTypes = ['application/pdf'];

    if (!validTypes.includes(file.type) && !file.name.match(/\.pdf$/i)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file only',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 10MB',
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateFromDocument = async () => {
    if (!selectedFile) {
      toast({
        title: 'Document required',
        description: 'Please upload a document to generate CompanyOS',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setGenerationStep('uploading');

    try {
      // Step 1: Extract text from PDF if it's a PDF file
      let extractedText: string | undefined;
      const isPDF = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
      
      if (isPDF) {
        setGenerationStep('extracting');
        setPdfExtractionProgress({ currentPage: 0, totalPages: 0 });
        try {
          extractedText = await extractTextFromPDF(selectedFile, (page, total) => {
            console.log(`📄 Extracting page ${page}/${total}...`);
            setPdfExtractionProgress({ currentPage: page, totalPages: total });
          });
          console.log('✅ PDF text extracted successfully:', extractedText.length, 'characters');
          setPdfExtractionProgress(null); // Clear progress on success
        } catch (pdfError) {
          console.error('PDF extraction error:', pdfError);
          setPdfExtractionProgress(null); // Clear progress on error
          
          // Check if error is about skipping browser extraction (file too large)
          const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          if (errorMessage.includes('will be extracted by the server') || errorMessage.includes('server extraction')) {
            // Silently continue - server will handle extraction
            console.log('📄 Browser extraction skipped, server will extract');
          } else {
            toast({
              title: 'PDF Extraction Warning',
              description: 'Failed to extract text from PDF. Server will attempt extraction.',
              variant: 'default'
            });
          }
          // Continue without extracted text - server will handle it
        }
      }

      // Step 2: Upload file to Supabase Storage
      const timestamp = Date.now();
      const sanitizedFileName = selectedFile.name.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
      const filePath = `${companyId}/company-os/${timestamp}-${sanitizedFileName}`;

      setGenerationStep('uploading');
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload document: ${uploadError.message}`);
      }

      // Step 3: Generate CompanyOS (with progress tracking)
      const { success, companyOS, error } = await generateCompanyOSFromDocument(
        {
          companyId,
          filePath,
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          additionalContext: documentContext || undefined,
          bucket: 'documents',
          extractedText, // Pass pre-extracted text if available
        },
        (step) => {
          if (step === 'extracting' && extractedText) {
            // Skip extracting step if we already extracted
            setGenerationStep('generating');
          } else {
            setGenerationStep(step);
          }
        }
      );

      if (!success || !companyOS) {
        throw new Error(error || 'Failed to generate CompanyOS from document');
      }

      toast({
        title: 'CompanyOS Generated!',
        description: 'Your company operating system has been created from the uploaded document.',
      });

      onGenerated(companyOS);
      setSelectedFile(null);
      setDocumentContext('');
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
      setGenerationStep(null);
      setPdfExtractionProgress(null); // Clear PDF extraction progress
    }
  };

  return (
    <Card className="shadow-none border border-gray-200">
      <CardHeader>
        <CardTitle className=" flex items-center gap-2" style={{ textTransform: 'none' }}>
          GENERATE CompanyOS
        </CardTitle>
        <CardDescription>
          Use AI-powered research or upload a document to create a comprehensive company operating system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="web-research" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
            <TabsTrigger 
              value="web-research" 
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Web Research</span>
              <span className="sm:hidden">Research</span>
            </TabsTrigger>
            <TabsTrigger 
              value="document-upload" 
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Document Upload</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="web-research" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name *
                </Label>
                <Input
                  id="companyName"
                  placeholder="e.g., Acme Corporation"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">
                  Industry / Sector
                </Label>
                <Input
                  id="industry"
                  placeholder="e.g., SaaS, E-commerce, Healthcare"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Helps guide the research
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://www.example.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Provides additional context for research
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="specificContext">
                  Specific Context
                </Label>
                <Textarea
                  id="specificContext"
                  placeholder="e.g., Target market is SMBs in North America, key competitors are X and Y..."
                  value={formData.specificContext}
                  onChange={(e) => setFormData({ ...formData, specificContext: e.target.value })}
                  disabled={isGenerating}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Add specific details to guide the AI research
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="font-medium text-sm">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>AI will research your company using Perplexity's web search</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Generate comprehensive brand strategy, market analysis, and positioning</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Create customer profiles, value propositions, and brand voice guidelines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>All AI agents will use this context to provide better, brand-aligned responses</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !formData.companyName.trim()}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Researching & Generating... (this may take 30-60 seconds)
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate CompanyOS
                </>
              )}
            </Button>

            {isGenerating && (
              <div className="text-center text-sm text-muted-foreground">
                <p>AI is conducting comprehensive research on your company...</p>
                <p className="mt-1">This process analyzes market data, competitors, and industry trends.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="document-upload" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documentUpload" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Upload Company Document *
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {selectedFile ? 'Change Document' : 'Choose Document'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    id="documentUpload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Supported format: PDF only (Max 10MB)
                </p>
                
                {selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      disabled={isGenerating}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentContext">
                  Additional Context
                </Label>
                <Textarea
                  id="documentContext"
                  placeholder="e.g., Focus on our B2B services, highlight our enterprise solutions..."
                  value={documentContext}
                  onChange={(e) => setDocumentContext(e.target.value)}
                  disabled={isGenerating}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Add specific instructions to guide the AI analysis
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h4 className="font-medium text-sm">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>AI will extract and analyze content from your uploaded document</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Generate comprehensive insights based on the document's content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Fill in any missing information with industry-standard assumptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>All AI agents will use this context for better, brand-aligned responses</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={handleGenerateFromDocument}
              disabled={isGenerating || !selectedFile}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {generationStep === 'uploading' && 'Uploading Document...'}
                  {generationStep === 'extracting' && 'Extracting Text...'}
                  {generationStep === 'generating' && 'Generating CompanyOS... (30-90 seconds)'}
                  {!generationStep && 'Processing...'}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate CompanyOS from Document
                </>
              )}
            </Button>

            {/* PDF Extraction Progress Card */}
            {generationStep === 'extracting' && pdfExtractionProgress && pdfExtractionProgress.totalPages > 0 && (
              <PDFExtractionProgress 
                currentPage={pdfExtractionProgress.currentPage}
                totalPages={pdfExtractionProgress.totalPages}
                status="Extracting text from PDF pages..."
              />
            )}

            {isGenerating && (
              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>
                  {generationStep === 'uploading' && 'Uploading your document to secure storage...'}
                  {generationStep === 'extracting' && !pdfExtractionProgress && 'Extracting text content from your document...'}
                  {generationStep === 'extracting' && pdfExtractionProgress && 'Extracting text content from your document...'}
                  {generationStep === 'generating' && 'AI is analyzing the content and generating comprehensive company insights...'}
                  {!generationStep && 'Processing your document...'}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${generationStep === 'uploading' ? 'bg-primary' : 'bg-muted'}`} />
                  <span className={generationStep === 'uploading' ? 'text-foreground font-medium' : ''}>Upload</span>
                  <span className="text-muted">→</span>
                  <div className={`h-2 w-2 rounded-full ${generationStep === 'extracting' ? 'bg-primary' : 'bg-muted'}`} />
                  <span className={generationStep === 'extracting' ? 'text-foreground font-medium' : ''}>Extract</span>
                  <span className="text-muted">→</span>
                  <div className={`h-2 w-2 rounded-full ${generationStep === 'generating' ? 'bg-primary' : 'bg-muted'}`} />
                  <span className={generationStep === 'generating' ? 'text-foreground font-medium' : ''}>Generate</span>
                </div>
                {generationStep === 'generating' && (
                  <p className="mt-1">This process may take longer for larger documents.</p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

