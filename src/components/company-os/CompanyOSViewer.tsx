import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Target, 
  TrendingUp, 
  Users, 
  Sparkles, 
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { CompanyOS } from '@/types/company-os';
import { calculateCompleteness, extractAssumptions } from '@/lib/company-os';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useState } from 'react';

interface CompanyOSViewerProps {
  companyOS: CompanyOS;
}

export function CompanyOSViewer({ companyOS }: CompanyOSViewerProps) {
  const osData = companyOS.os_data;
  const core = osData.coreIdentityAndStrategicFoundation;
  const market = osData.customerAndMarketContext;
  const brand = osData.brandVoiceAndExpression;
  
  const completeness = calculateCompleteness(osData);
  const assumptions = extractAssumptions(osData);
  const [showRawText, setShowRawText] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-none border border-gray-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{completeness}%</div>
            <p className="text-xs text-muted-foreground">Completeness</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-gray-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">v{companyOS.version}</div>
            <p className="text-xs text-muted-foreground">Version</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-gray-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{assumptions.length}</div>
            <p className="text-xs text-muted-foreground">Assumptions</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border border-gray-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {new Date(companyOS.last_updated).toLocaleDateString()}
            </div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      {/* Assumptions Alert */}
      {assumptions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              AI-Generated Assumptions
            </CardTitle>
            <CardDescription>
              The following {assumptions.length} item{assumptions.length !== 1 ? 's were' : ' was'} inferred through research and marked as assumptions
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Core Identity & Strategic Foundation */}
      <Card className="shadow-none border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Core Identity & Strategic Foundation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">Company Overview</h4>
            <p className="text-sm text-muted-foreground">{core.companyOverview}</p>
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Mission</h4>
              <p className="text-sm text-muted-foreground">{core.missionAndVision.missionStatement}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Vision</h4>
              <p className="text-sm text-muted-foreground">{core.missionAndVision.visionStatement}</p>
            </div>
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-3">Core Values</h4>
              <div className="space-y-2">
                {(core.coreValues || []).map((value, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Core Competencies</h4>
              <div className="space-y-2">
                {(core.coreCompetencies || []).map((comp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{comp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Positioning Statement</h4>
            <div className="space-y-3 bg-gray-100 p-4 rounded-lg">
              <div>
                <Badge variant="outline" className="mb-1">Target Segment</Badge>
                <p className="text-sm">{core.positioningStatement.targetSegment}</p>
              </div>
              <div>
                <Badge variant="outline" className="mb-1">Category</Badge>
                <p className="text-sm">{core.positioningStatement.category}</p>
              </div>
              <div>
                <Badge variant="outline" className="mb-1">Unique Benefit</Badge>
                <p className="text-sm">{core.positioningStatement.uniqueBenefit}</p>
              </div>
              <div>
                <Badge variant="outline" className="mb-1">Reason to Believe</Badge>
                <p className="text-sm">{core.positioningStatement.reasonToBelieve}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Business Model</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Badge variant="secondary" className="mb-2">Revenue Model</Badge>
                <p className="text-sm text-muted-foreground">{core.businessModel.revenueModel}</p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">Pricing Strategy</Badge>
                <p className="text-sm text-muted-foreground">{core.businessModel.pricingStrategy}</p>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">Distribution</Badge>
                <div className="space-y-1">
                  {(core.businessModel?.distributionChannels || []).map((channel, idx) => (
                    <p key={idx} className="text-sm text-muted-foreground">• {channel}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Right to Win</h4>
            <p className="text-sm text-muted-foreground font-medium bg-primary/10 p-3 rounded-lg">
              {core.rightToWin}
            </p>
          </div>

          <Separator />

          <Accordion type="single" collapsible>
            <AccordionItem value="swot">
              <AccordionTrigger>SWOT Analysis</AccordionTrigger>
              <AccordionContent>
                <div className="grid md:grid-cols-2 gap-4 pt-4">
                  <div>
                    <h5 className="font-semibold text-green-600 dark:text-green-500 mb-2">Strengths</h5>
                    <ul className="space-y-1">
                      {(core.swotAnalysis?.strengths || []).map((s, idx) => (
                        <li key={idx} className="text-sm">• {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-blue-600 dark:text-blue-500 mb-2">Opportunities</h5>
                    <ul className="space-y-1">
                      {(core.swotAnalysis?.opportunities || []).map((o, idx) => (
                        <li key={idx} className="text-sm">• {o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-amber-600 dark:text-amber-500 mb-2">Weaknesses</h5>
                    <ul className="space-y-1">
                      {(core.swotAnalysis?.weaknesses || []).map((w, idx) => (
                        <li key={idx} className="text-sm">• {w}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-semibold text-red-600 dark:text-red-500 mb-2">Threats</h5>
                    <ul className="space-y-1">
                      {(core.swotAnalysis?.threats || []).map((t, idx) => (
                        <li key={idx} className="text-sm">• {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Customer & Market Context */}
      <Card className="shadow-none border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer & Market Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-3">Ideal Customer Profile</h4>
            <div className="space-y-3 bg-gray-100 p-4 rounded-lg">
              <div>
                <Badge variant="outline" className="mb-1">Defining Traits</Badge>
                <p className="text-sm">{market.idealCustomerProfile.definingTraits}</p>
              </div>
              <div>
                <Badge variant="outline" className="mb-1">Key Demographics</Badge>
                <p className="text-sm">{market.idealCustomerProfile.keyDemographics}</p>
              </div>
              <div>
                <Badge variant="outline" className="mb-1">Representative Persona</Badge>
                <p className="text-sm italic">{market.idealCustomerProfile.representativePersona}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Customer Segments</h4>
            <div className="grid gap-3">
              {(market.customerSegments || []).map((segment, idx) => (
                <div key={idx} className="border rounded-lg p-3">
                  <h5 className="font-medium mb-1">{segment.segment}</h5>
                  <p className="text-sm text-muted-foreground">{segment.description}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-3">Top Pain Points</h4>
              <ul className="space-y-2">
                {(market.customerJourney?.topPainPoints || []).map((pain, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <Target className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <span>{pain}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Improvement Opportunities</h4>
              <ul className="space-y-2">
                {(market.customerJourney?.topImprovementOpportunities || []).map((opp, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Market Analysis</h4>
            <p className="text-sm text-muted-foreground mb-3">{market.marketAnalysis.primaryCategoryAnalysis}</p>
            <div>
              <Badge variant="destructive" className="mb-2">Key Competitors</Badge>
              <div className="flex flex-wrap gap-2">
                {(market.marketAnalysis?.topDirectCompetitors || []).map((comp, idx) => (
                  <Badge key={idx} variant="outline">{comp}</Badge>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Value Propositions</h4>
            <div className="space-y-3">
              {(market.valuePropositions || []).map((vp, idx) => (
                <div key={idx} className="bg-primary/5 border-l-4 border-primary p-3 rounded">
                  <p className="font-medium text-sm mb-1">{vp.clientType}</p>
                  <p className="text-sm text-muted-foreground">{vp.value}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Voice & Expression */}
      <Card className="shadow-none border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Brand Voice & Expression
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2">Brand Purpose</h4>
            <p className="text-sm text-muted-foreground font-medium bg-primary/10 p-3 rounded-lg">
              {brand.brandPurpose}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">The Hot Take 🔥</h4>
            <p className="text-sm text-muted-foreground italic bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border-l-4 border-orange-500">
              {brand.theHotTake}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Powerful Beliefs</h4>
            <div className="space-y-2">
              {(brand.powerfulBeliefs || []).map((belief, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-gray-100 p-3 rounded-lg">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm font-medium">{belief}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Customer Transformation</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                <Badge variant="destructive" className="mb-2">From (Before)</Badge>
                <p className="text-sm">{brand.transformation.from}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                <Badge className="mb-2 bg-green-600">To (After)</Badge>
                <p className="text-sm">{brand.transformation.to}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Brand Voice Guidelines</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Badge className="mb-2 bg-green-600">Do's ✓</Badge>
                <ul className="space-y-2">
                  {(brand.brandVoiceDosAndDonts?.dos || []).map((d, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Badge variant="destructive" className="mb-2">Don'ts ✗</Badge>
                <ul className="space-y-2">
                  {(brand.brandVoiceDosAndDonts?.donts || []).map((d, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Voice Analogue</h4>
            <p className="text-sm bg-gray-100 p-3 rounded-lg">
              <span className="font-medium">Sounds like:</span> {brand.celebrityAnalogue}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Content Strategy</h4>
            <div className="space-y-4">
              <div>
                <Badge variant="secondary" className="mb-2">Content Pillars</Badge>
                <ul className="space-y-1">
                  {(brand.contentStrategy?.pillars || []).map((pillar, idx) => (
                    <li key={idx} className="text-sm">• {pillar}</li>
                  ))}
                </ul>
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">Strategic Imperatives</Badge>
                <ul className="space-y-1">
                  {(brand.contentStrategy?.keyStrategicImperatives || []).map((imp, idx) => (
                    <li key={idx} className="text-sm font-medium">→ {imp}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Scraped Text Section - Only show for document uploads */}
      {companyOS.raw_scraped_text && companyOS.metadata?.source_type === 'document_upload' && (
        <Card className="shadow-none border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Raw Document Text
            </CardTitle>
            <CardDescription>
              The extracted text from your uploaded document that was used to generate this CompanyOS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Document: {companyOS.metadata?.source_document?.fileName || 'Unknown'}
                </div>
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  {showRawText ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide Text
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show Text
                    </>
                  )}
                </button>
              </div>
              
              {showRawText && (
                <div className="bg-gray-100 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                    {companyOS.raw_scraped_text}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

