import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckIcon, XMarkIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { updateCompanyOS } from '@/lib/company-os';
import { useToast } from '@/hooks/use-toast';
import type { CompanyOS, CompanyOSData } from '@/types/company-os';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CompanyOSEditorProps {
  companyOS: CompanyOS;
  onSaved: (companyOS: CompanyOS) => void;
  onCancel: () => void;
}

export function CompanyOSEditor({ companyOS, onSaved, onCancel }: CompanyOSEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<CompanyOSData>(companyOS.os_data);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { success, companyOS: updatedOS, error } = await updateCompanyOS(
        companyOS.company_id,
        editedData
      );

      if (!success || !updatedOS) {
        throw new Error(error || 'Failed to update CompanyOS');
      }

      toast({
        title: 'CompanyOS Updated!',
        description: 'Your changes have been saved successfully.',
      });

      onSaved(updatedOS);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (path: string[], value: any) => {
    const newData = JSON.parse(JSON.stringify(editedData)); // Deep clone
    let current: any = newData;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setEditedData(newData);
  };

  const getFieldValue = (path: string[]): any => {
    let current: any = editedData;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  };

  const addArrayItem = (path: string[]) => {
    const array = getFieldValue(path) || [];
    updateField(path, [...array, '']);
  };

  const removeArrayItem = (path: string[], index: number) => {
    const array = getFieldValue(path) || [];
    updateField(path, array.filter((_: any, i: number) => i !== index));
  };

  const updateArrayItem = (path: string[], index: number, value: string) => {
    const array = getFieldValue(path) || [];
    const newArray = [...array];
    newArray[index] = value;
    updateField(path, newArray);
  };

  const addObjectToArray = (path: string[], defaultObject: any) => {
    const array = getFieldValue(path) || [];
    updateField(path, [...array, { ...defaultObject }]);
  };

  const removeObjectFromArray = (path: string[], index: number) => {
    const array = getFieldValue(path) || [];
    updateField(path, array.filter((_: any, i: number) => i !== index));
  };

  const updateObjectInArray = (path: string[], index: number, field: string, value: string) => {
    const array = getFieldValue(path) || [];
    const newArray = [...array];
    newArray[index] = { ...newArray[index], [field]: value };
    updateField(path, newArray);
  };

  const core = editedData.coreIdentityAndStrategicFoundation;
  const market = editedData.customerAndMarketContext;
  const brand = editedData.brandVoiceAndExpression;

  return (
    <div className="space-y-6">
      <Card className="shadow-none border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ textTransform: 'none' }}>
            <PencilIcon className="h-5 w-5" />
            EDIT CompanyOS
          </CardTitle>
          <CardDescription>
            Refine and customize your company operating system. All changes will create a new version.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="core" className="w-full space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
          <TabsTrigger 
            value="core" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Core Identity
          </TabsTrigger>
          <TabsTrigger 
            value="market" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Market Context
          </TabsTrigger>
          <TabsTrigger 
            value="brand" 
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Brand Voice
          </TabsTrigger>
        </TabsList>

        {/* Core Identity Tab */}
        <TabsContent value="core" className="space-y-4">
          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Company Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={core.companyOverview}
                onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'companyOverview'], e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Mission & Vision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mission Statement</Label>
                <Textarea
                  value={core.missionAndVision.missionStatement}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'missionAndVision', 'missionStatement'], e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Vision Statement</Label>
                <Textarea
                  value={core.missionAndVision.visionStatement}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'missionAndVision', 'visionStatement'], e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Right to Win</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={core.rightToWin}
                onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'rightToWin'], e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Core Values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(core.coreValues || []).map((value, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={value}
                    onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'coreValues'], idx, e.target.value)}
                    placeholder="Enter a core value"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'coreValues'], idx)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'coreValues'])}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Core Value
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Core Competencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(core.coreCompetencies || []).map((comp, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={comp}
                    onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'coreCompetencies'], idx, e.target.value)}
                    placeholder="Enter a core competency"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'coreCompetencies'], idx)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'coreCompetencies'])}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Core Competency
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Positioning Statement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Target Segment</Label>
                <Textarea
                  value={core.positioningStatement?.targetSegment || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'positioningStatement', 'targetSegment'], e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Textarea
                  value={core.positioningStatement?.category || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'positioningStatement', 'category'], e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Unique Benefit</Label>
                <Textarea
                  value={core.positioningStatement?.uniqueBenefit || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'positioningStatement', 'uniqueBenefit'], e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason to Believe</Label>
                <Textarea
                  value={core.positioningStatement?.reasonToBelieve || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'positioningStatement', 'reasonToBelieve'], e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Business Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Revenue Model</Label>
                <Textarea
                  value={core.businessModel?.revenueModel || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'businessModel', 'revenueModel'], e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Pricing Strategy</Label>
                <Textarea
                  value={core.businessModel?.pricingStrategy || ''}
                  onChange={(e) => updateField(['coreIdentityAndStrategicFoundation', 'businessModel', 'pricingStrategy'], e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Distribution Channels</Label>
                <div className="space-y-2">
                  {(core.businessModel?.distributionChannels || []).map((channel, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={channel}
                        onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'businessModel', 'distributionChannels'], idx, e.target.value)}
                        placeholder="Enter a distribution channel"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'businessModel', 'distributionChannels'], idx)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'businessModel', 'distributionChannels'])}
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Distribution Channel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Key Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(core.keyPerformanceIndicators || []).map((kpi, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={kpi}
                    onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'keyPerformanceIndicators'], idx, e.target.value)}
                    placeholder="Enter a KPI"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'keyPerformanceIndicators'], idx)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'keyPerformanceIndicators'])}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add KPI
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">SWOT Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Strengths</Label>
                {(core.swotAnalysis?.strengths || []).map((strength, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={strength}
                      onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'strengths'], idx, e.target.value)}
                      placeholder="Enter a strength"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'strengths'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'strengths'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Strength
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Weaknesses</Label>
                {(core.swotAnalysis?.weaknesses || []).map((weakness, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={weakness}
                      onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'weaknesses'], idx, e.target.value)}
                      placeholder="Enter a weakness"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'weaknesses'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'weaknesses'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Weakness
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Opportunities</Label>
                {(core.swotAnalysis?.opportunities || []).map((opportunity, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={opportunity}
                      onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'opportunities'], idx, e.target.value)}
                      placeholder="Enter an opportunity"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'opportunities'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'opportunities'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Opportunity
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Threats</Label>
                {(core.swotAnalysis?.threats || []).map((threat, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={threat}
                      onChange={(e) => updateArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'threats'], idx, e.target.value)}
                      placeholder="Enter a threat"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'threats'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['coreIdentityAndStrategicFoundation', 'swotAnalysis', 'threats'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Threat
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market Context Tab */}
        <TabsContent value="market" className="space-y-4">
          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Ideal Customer Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Defining Traits</Label>
                <Textarea
                  value={market.idealCustomerProfile.definingTraits}
                  onChange={(e) => updateField(['customerAndMarketContext', 'idealCustomerProfile', 'definingTraits'], e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Key Demographics</Label>
                <Textarea
                  value={market.idealCustomerProfile.keyDemographics}
                  onChange={(e) => updateField(['customerAndMarketContext', 'idealCustomerProfile', 'keyDemographics'], e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Representative Persona</Label>
                <Textarea
                  value={market.idealCustomerProfile.representativePersona}
                  onChange={(e) => updateField(['customerAndMarketContext', 'idealCustomerProfile', 'representativePersona'], e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Market Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Category Analysis</Label>
                <Textarea
                  value={market.marketAnalysis.primaryCategoryAnalysis}
                  onChange={(e) => updateField(['customerAndMarketContext', 'marketAnalysis', 'primaryCategoryAnalysis'], e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Top Direct Competitors (comma-separated)</Label>
                <Input
                  value={market.marketAnalysis.topDirectCompetitors.join(', ')}
                  onChange={(e) => updateField(['customerAndMarketContext', 'marketAnalysis', 'topDirectCompetitors'], e.target.value.split(',').map(s => s.trim()))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Customer Segments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(market.customerSegments || []).map((segment, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Segment {idx + 1}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeObjectFromArray(['customerAndMarketContext', 'customerSegments'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={segment.segment || ''}
                    onChange={(e) => updateObjectInArray(['customerAndMarketContext', 'customerSegments'], idx, 'segment', e.target.value)}
                    placeholder="Segment name"
                  />
                  <Textarea
                    value={segment.description || ''}
                    onChange={(e) => updateObjectInArray(['customerAndMarketContext', 'customerSegments'], idx, 'description', e.target.value)}
                    placeholder="Segment description"
                    rows={2}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addObjectToArray(['customerAndMarketContext', 'customerSegments'], { segment: '', description: '' })}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Customer Segment
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Customer Journey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Top Pain Points</Label>
                {(market.customerJourney?.topPainPoints || []).map((pain, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={pain}
                      onChange={(e) => updateArrayItem(['customerAndMarketContext', 'customerJourney', 'topPainPoints'], idx, e.target.value)}
                      placeholder="Enter a pain point"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['customerAndMarketContext', 'customerJourney', 'topPainPoints'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['customerAndMarketContext', 'customerJourney', 'topPainPoints'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Pain Point
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Top Improvement Opportunities</Label>
                {(market.customerJourney?.topImprovementOpportunities || []).map((opp, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={opp}
                      onChange={(e) => updateArrayItem(['customerAndMarketContext', 'customerJourney', 'topImprovementOpportunities'], idx, e.target.value)}
                      placeholder="Enter an improvement opportunity"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['customerAndMarketContext', 'customerJourney', 'topImprovementOpportunities'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['customerAndMarketContext', 'customerJourney', 'topImprovementOpportunities'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Opportunity
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Value Propositions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(market.valuePropositions || []).map((vp, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">Value Proposition {idx + 1}</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeObjectFromArray(['customerAndMarketContext', 'valuePropositions'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={vp.clientType || ''}
                    onChange={(e) => updateObjectInArray(['customerAndMarketContext', 'valuePropositions'], idx, 'clientType', e.target.value)}
                    placeholder="Client type"
                  />
                  <Textarea
                    value={vp.value || ''}
                    onChange={(e) => updateObjectInArray(['customerAndMarketContext', 'valuePropositions'], idx, 'value', e.target.value)}
                    placeholder="Value proposition"
                    rows={2}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addObjectToArray(['customerAndMarketContext', 'valuePropositions'], { clientType: '', value: '' })}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Value Proposition
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand Voice Tab */}
        <TabsContent value="brand" className="space-y-4">
          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Brand Purpose</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={brand.brandPurpose}
                onChange={(e) => updateField(['brandVoiceAndExpression', 'brandPurpose'], e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">The Hot Take</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={brand.theHotTake}
                onChange={(e) => updateField(['brandVoiceAndExpression', 'theHotTake'], e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Customer Transformation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>From (Before State)</Label>
                <Textarea
                  value={brand.transformation.from}
                  onChange={(e) => updateField(['brandVoiceAndExpression', 'transformation', 'from'], e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>To (After State)</Label>
                <Textarea
                  value={brand.transformation.to}
                  onChange={(e) => updateField(['brandVoiceAndExpression', 'transformation', 'to'], e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200" >
            <CardHeader>
              <CardTitle className="text-lg">Voice Analogue</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={brand.celebrityAnalogue}
                onChange={(e) => updateField(['brandVoiceAndExpression', 'celebrityAnalogue'], e.target.value)}
                placeholder="Celebrity or public figure who embodies the brand voice"
              />
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Powerful Beliefs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(brand.powerfulBeliefs || []).map((belief, idx) => (
                <div key={idx} className="flex gap-2">
                  <Textarea
                    value={belief}
                    onChange={(e) => updateArrayItem(['brandVoiceAndExpression', 'powerfulBeliefs'], idx, e.target.value)}
                    placeholder="Enter a powerful belief"
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeArrayItem(['brandVoiceAndExpression', 'powerfulBeliefs'], idx)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addArrayItem(['brandVoiceAndExpression', 'powerfulBeliefs'])}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Powerful Belief
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Brand Voice Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Do's</Label>
                {(brand.brandVoiceDosAndDonts?.dos || []).map((doItem, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={doItem}
                      onChange={(e) => updateArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'dos'], idx, e.target.value)}
                      placeholder="Enter a 'do' guideline"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'dos'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'dos'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Do
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Don'ts</Label>
                {(brand.brandVoiceDosAndDonts?.donts || []).map((dont, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={dont}
                      onChange={(e) => updateArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'donts'], idx, e.target.value)}
                      placeholder="Enter a 'don't' guideline"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'donts'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['brandVoiceAndExpression', 'brandVoiceDosAndDonts', 'donts'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Don't
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg">Content Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Content Pillars</Label>
                {(brand.contentStrategy?.pillars || []).map((pillar, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={pillar}
                      onChange={(e) => updateArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'pillars'], idx, e.target.value)}
                      placeholder="Enter a content pillar"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'pillars'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'pillars'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Content Pillar
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Key Strategic Imperatives</Label>
                {(brand.contentStrategy?.keyStrategicImperatives || []).map((imperative, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Textarea
                      value={imperative}
                      onChange={(e) => updateArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'keyStrategicImperatives'], idx, e.target.value)}
                      placeholder="Enter a strategic imperative"
                      rows={2}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'keyStrategicImperatives'], idx)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addArrayItem(['brandVoiceAndExpression', 'contentStrategy', 'keyStrategicImperatives'])}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Strategic Imperative
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-4 sticky bottom-0 bg-background p-4 border-t">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="lg"
          className="flex-1"
        >
          {isSaving ? (
            <>
              <CheckIcon className="mr-2 h-4 w-4 animate-pulse" />
              Saving...
            </>
          ) : (
            <>
              <CheckIcon className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="lg"
          disabled={isSaving}
        >
          <XMarkIcon className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

