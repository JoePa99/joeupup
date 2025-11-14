import { supabase } from '@/integrations/supabase/client';
import type { 
  CompanyOS, 
  CompanyOSData, 
  GenerateCompanyOSRequest, 
  GenerateCompanyOSFromDocumentRequest,
  ExtractDocumentTextRequest,
  ExtractDocumentTextResponse,
  GenerateFromTextRequest,
  GenerateFromTextResponse
} from '@/types/company-os';

/**
 * Generate a new CompanyOS using Perplexity AI research
 */
export async function generateCompanyOS(
  request: GenerateCompanyOSRequest
): Promise<{ success: boolean; companyOS?: CompanyOS; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-company-os', {
      body: request
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate CompanyOS');
    }

    return {
      success: true,
      companyOS: data.companyOS
    };
  } catch (error) {
    console.error('Error generating CompanyOS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Extract text from a document (Step 1 of two-step process)
 */
export async function extractDocumentText(
  request: ExtractDocumentTextRequest
): Promise<ExtractDocumentTextResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('extract-document-text', {
      body: request
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to extract text from document');
    }

    return data as ExtractDocumentTextResponse;
  } catch (error) {
    console.error('Error extracting document text:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate CompanyOS from extracted text (Step 2 of two-step process)
 */
export async function generateFromExtractedText(
  request: GenerateFromTextRequest
): Promise<GenerateFromTextResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-company-os-from-text', {
      body: request
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate CompanyOS from text');
    }

    return data as GenerateFromTextResponse;
  } catch (error) {
    console.error('Error generating CompanyOS from text:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generate a new CompanyOS from an uploaded document using OpenAI (two-step process)
 * 1. Extracts text from the document
 * 2. Generates CompanyOS from the extracted text
 */
export async function generateCompanyOSFromDocument(
  request: GenerateCompanyOSFromDocumentRequest,
  onProgress?: (step: 'extracting' | 'generating') => void
): Promise<{ success: boolean; companyOS?: CompanyOS; error?: string; extractedText?: string }> {
  try {
    // Step 1: Extract text from document
    onProgress?.('extracting');
    console.log('📄 Step 1: Extracting text from document...');
    
    const extractResult = await extractDocumentText({
      companyId: request.companyId,
      filePath: request.filePath,
      fileName: request.fileName,
      fileType: request.fileType,
      bucket: request.bucket,
      extractedText: request.extractedText // Pass pre-extracted text if available
    });

    if (!extractResult.success) {
      throw new Error(extractResult.error || 'Failed to process document');
    }

    // New flow: extract-document-text triggers generate-company-os-from-document on the server.
    // We now poll for the generated CompanyOS until it is available or timeout.
    onProgress?.('generating');
    console.log('🤖 Step 2: Waiting for CompanyOS generation to complete...');

    const start = Date.now();
    const timeoutMs = 90_000; // up to 90s
    const pollIntervalMs = 3000;
    let lastStatus: string | undefined;

    while (Date.now() - start < timeoutMs) {
      const { data, error } = await supabase
        .from('company_os' as any)
        .select('*')
        .eq('company_id', request.companyId)
        .single();

      if (!error && data) {
        lastStatus = data.status;
        if (data.status === 'completed' && data.os_data) {
          console.log('✅ CompanyOS generation completed');
          return {
            success: true,
            companyOS: data as unknown as CompanyOS,
          };
        }
      }

      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    console.warn('⏱️ CompanyOS generation is still in progress, returning without result');
    return {
      success: true,
      companyOS: undefined,
      error: lastStatus === 'failed' ? 'Generation failed on server' : undefined
    };
  } catch (error) {
    console.error('Error generating CompanyOS from document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get CompanyOS for a specific company
 */
export async function getCompanyOS(
  companyId: string
): Promise<{ success: boolean; companyOS?: CompanyOS; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('company_os' as any)
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - CompanyOS doesn't exist yet
        return { success: true, companyOS: undefined };
      }
      throw error;
    }

    return {
      success: true,
      companyOS: data as unknown as CompanyOS
    };
  } catch (error) {
    console.error('Error fetching CompanyOS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Update CompanyOS data manually
 */
export async function updateCompanyOS(
  companyId: string,
  osData: CompanyOSData
): Promise<{ success: boolean; companyOS?: CompanyOS; error?: string }> {
  try {
    // Get current version
    const { data: existing } = await supabase
      .from('company_os' as any)
      .select('version')
      .eq('company_id', companyId)
      .single();

    const currentVersion = (existing as any)?.version || 1;

    const { data, error } = await supabase
      .from('company_os' as any)
      .update({
        os_data: osData,
        version: currentVersion + 1,
        last_updated: new Date().toISOString()
      })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      companyOS: data as unknown as CompanyOS
    };
  } catch (error) {
    console.error('Error updating CompanyOS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Format CompanyOS data as markdown context for AI agents
 */
export function formatCompanyOSAsContext(osData: CompanyOSData): string {
  const core = osData.coreIdentityAndStrategicFoundation;
  const market = osData.customerAndMarketContext;
  const brand = osData.brandVoiceAndExpression;

  return `# Company Context (CompanyOS)

## Core Identity & Strategic Foundation

### Company Overview
${core.companyOverview}

### Mission & Vision
**Mission:** ${core.missionAndVision.missionStatement}
**Vision:** ${core.missionAndVision.visionStatement}

### Core Values
${core.coreValues.map(v => `- ${v}`).join('\n')}

### Core Competencies
${core.coreCompetencies.map(c => `- ${c}`).join('\n')}

### Positioning
- **Target Segment:** ${core.positioningStatement.targetSegment}
- **Category:** ${core.positioningStatement.category}
- **Unique Benefit:** ${core.positioningStatement.uniqueBenefit}
- **Reason to Believe:** ${core.positioningStatement.reasonToBelieve}

### Business Model
- **Revenue Model:** ${core.businessModel.revenueModel}
- **Pricing Strategy:** ${core.businessModel.pricingStrategy}
- **Distribution Channels:** ${core.businessModel.distributionChannels.join(', ')}

### Right to Win
${core.rightToWin}

## Customer & Market Context

### Ideal Customer Profile
**Defining Traits:** ${market.idealCustomerProfile.definingTraits}
**Key Demographics:** ${market.idealCustomerProfile.keyDemographics}
**Persona:** ${market.idealCustomerProfile.representativePersona}

### Customer Segments
${market.customerSegments.map(s => `- **${s.segment}:** ${s.description}`).join('\n')}

### Customer Pain Points
${market.customerJourney.topPainPoints.map(p => `- ${p}`).join('\n')}

### Market Analysis
${market.marketAnalysis.primaryCategoryAnalysis}

**Key Competitors:** ${market.marketAnalysis.topDirectCompetitors.join(', ')}

### Value Propositions
${market.valuePropositions.map(vp => `- **${vp.clientType}:** ${vp.value}`).join('\n')}

## Brand Voice & Expression

### Brand Purpose
${brand.brandPurpose}

### The Hot Take
${brand.theHotTake}

### Powerful Beliefs
${brand.powerfulBeliefs.map(b => `- ${b}`).join('\n')}

### Customer Transformation
**From:** ${brand.transformation.from}
**To:** ${brand.transformation.to}

### Brand Voice Guidelines
**Do's:**
${brand.brandVoiceDosAndDonts.dos.map(d => `- ${d}`).join('\n')}

**Don'ts:**
${brand.brandVoiceDosAndDonts.donts.map(d => `- ${d}`).join('\n')}

### Voice Analogue
${brand.celebrityAnalogue}

### Content Strategy
**Pillars:**
${brand.contentStrategy.pillars.map(p => `- ${p}`).join('\n')}

**Strategic Imperatives:**
${brand.contentStrategy.keyStrategicImperatives.map(i => `- ${i}`).join('\n')}`;
}

/**
 * Check if text contains assumptions
 */
export function hasAssumptions(text: string): boolean {
  return text.includes('(Assumed)');
}

/**
 * Extract assumptions from CompanyOS
 */
export function extractAssumptions(osData: CompanyOSData): string[] {
  const assumptions: string[] = [];
  const jsonString = JSON.stringify(osData);
  
  // Find all text segments that end with (Assumed)
  const regex = /"([^"]*\(Assumed\)[^"]*)"/g;
  let match;
  
  while ((match = regex.exec(jsonString)) !== null) {
    assumptions.push(match[1]);
  }
  
  return assumptions;
}

/**
 * Calculate completeness score of CompanyOS
 */
export function calculateCompleteness(osData: CompanyOSData): number {
  let totalFields = 0;
  let filledFields = 0;

  const checkField = (value: any) => {
    totalFields++;
    if (value && value !== '' && (!Array.isArray(value) || value.length > 0)) {
      filledFields++;
    }
  };

  const checkObject = (obj: any) => {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        checkObject(value);
      } else {
        checkField(value);
      }
    }
  };

  checkObject(osData);

  return Math.round((filledFields / totalFields) * 100);
}

