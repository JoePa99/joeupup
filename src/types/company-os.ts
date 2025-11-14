// CompanyOS Type Definitions
// Matches the schema from the AI Context Pack Generation Prompt

export interface MissionAndVision {
  missionStatement: string;
  visionStatement: string;
}

export interface PositioningStatement {
  targetSegment: string;
  category: string;
  uniqueBenefit: string;
  reasonToBelieve: string;
}

export interface BusinessModel {
  revenueModel: string;
  pricingStrategy: string;
  distributionChannels: string[];
}

export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface CoreIdentityAndStrategicFoundation {
  companyOverview: string;
  missionAndVision: MissionAndVision;
  coreValues: string[];
  coreCompetencies: string[];
  positioningStatement: PositioningStatement;
  businessModel: BusinessModel;
  keyPerformanceIndicators: string[];
  rightToWin: string;
  swotAnalysis: SWOTAnalysis;
}

export interface IdealCustomerProfile {
  definingTraits: string;
  keyDemographics: string;
  representativePersona: string;
}

export interface CustomerSegment {
  segment: string;
  description: string;
}

export interface CustomerJourney {
  topPainPoints: string[];
  topImprovementOpportunities: string[];
}

export interface MarketAnalysis {
  primaryCategoryAnalysis: string;
  topDirectCompetitors: string[];
}

export interface ValueProposition {
  clientType: string;
  value: string;
}

export interface CustomerAndMarketContext {
  idealCustomerProfile: IdealCustomerProfile;
  customerSegments: CustomerSegment[];
  customerJourney: CustomerJourney;
  marketAnalysis: MarketAnalysis;
  valuePropositions: ValueProposition[];
}

export interface Transformation {
  from: string;
  to: string;
}

export interface BrandVoiceDosAndDonts {
  dos: string[];
  donts: string[];
}

export interface ContentStrategy {
  pillars: string[];
  keyStrategicImperatives: string[];
}

export interface BrandVoiceAndExpression {
  brandPurpose: string;
  theHotTake: string;
  powerfulBeliefs: string[];
  transformation: Transformation;
  brandVoiceDosAndDonts: BrandVoiceDosAndDonts;
  celebrityAnalogue: string;
  contentStrategy: ContentStrategy;
}

export interface CompanyOSData {
  coreIdentityAndStrategicFoundation: CoreIdentityAndStrategicFoundation;
  customerAndMarketContext: CustomerAndMarketContext;
  brandVoiceAndExpression: BrandVoiceAndExpression;
}

export type CompanyOSStatus = 'draft' | 'extracting' | 'generating' | 'completed' | 'failed';

export interface CompanyOS {
  id: string;
  company_id: string;
  os_data: CompanyOSData | Record<string, never>;
  version: number;
  generated_at: string;
  last_updated: string;
  generated_by: string | null;
  source_url: string | null;
  raw_scraped_text?: string | null;
  status: CompanyOSStatus;
  confidence_score: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GenerateCompanyOSRequest {
  companyName: string;
  industry?: string;
  specificContext?: string;
  websiteUrl?: string;
  companyId: string;
}

export interface GenerateCompanyOSFromDocumentRequest {
  companyId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  additionalContext?: string;
  bucket?: string;
  extractedText?: string; // Optional: pre-extracted text from frontend
}

export interface GenerateCompanyOSResponse {
  success: boolean;
  companyOS?: CompanyOS;
  metadata?: {
    companyName?: string;
    industry?: string;
    websiteUrl?: string;
    fileName?: string;
    sourceType?: 'web_research' | 'document_upload';
    generated_at: string;
    execution_time: number;
    model: string;
  };
  error?: string;
}

// New types for two-step document processing
export interface ExtractDocumentTextRequest {
  companyId: string;
  filePath: string;
  fileName: string;
  fileType: string;
  bucket?: string;
  extractedText?: string; // Optional: pre-extracted text from frontend
}

export interface ExtractDocumentTextResponse {
  success: boolean;
  extractedText?: string;
  textLength?: number;
  recordId?: string;
  metadata?: {
    fileName: string;
    extractionTime: number;
    extractionMethod?: string;
    openAIFileId?: string;
    openAIResponseId?: string;
  };
  error?: string;
}

export interface GenerateFromTextRequest {
  companyId: string;
  extractedText?: string;
  additionalContext?: string;
}

export interface GenerateFromTextResponse {
  success: boolean;
  companyOS?: CompanyOS;
  metadata?: {
    sourceType: string;
    generated_at: string;
    execution_time: number;
    model: string;
  };
  error?: string;
}

