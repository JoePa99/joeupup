import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Edit, Save, X, Eye, EyeOff, FileText, ChevronDown } from "lucide-react";

interface KnowledgeBase {
  companyOverview: string;
  missionVision: string;
  products: string;
  targetMarket: string;
  keyDifferentiators: string;
  websiteAnalysis: string;
}

interface KnowledgePreviewProps {
  knowledgeBase: KnowledgeBase;
  onChange: (knowledgeBase: KnowledgeBase) => void;
  uploadedDocuments?: any[];
}

interface KnowledgeSection {
  key: keyof KnowledgeBase;
  title: string;
  description: string;
  placeholder: string;
  required: boolean;
}

const knowledgeSections: KnowledgeSection[] = [
  {
    key: 'companyOverview',
    title: 'Company Overview',
    description: 'High-level description of your business and what you do',
    placeholder: 'Describe your company, its history, and primary business activities...',
    required: true
  },
  {
    key: 'missionVision',
    title: 'Mission & Vision',
    description: 'Your company\'s mission statement and vision for the future',
    placeholder: 'What is your company\'s mission and long-term vision?',
    required: true
  },
  {
    key: 'products',
    title: 'Products & Services',
    description: 'Detailed information about what you offer to customers',
    placeholder: 'Describe your main products and services in detail...',
    required: true
  },
  {
    key: 'targetMarket',
    title: 'Target Market',
    description: 'Your ideal customers and market segments',
    placeholder: 'Who are your target customers? What markets do you serve?',
    required: false
  },
  {
    key: 'keyDifferentiators',
    title: 'Key Differentiators',
    description: 'What sets your company apart from competitors',
    placeholder: 'What makes your company unique? What are your competitive advantages?',
    required: false
  },
  {
    key: 'websiteAnalysis',
    title: 'Website Analysis',
    description: 'Analysis results from your website content',
    placeholder: 'Technical analysis and extracted information from your website...',
    required: false
  }
];

export function KnowledgePreview({ knowledgeBase, onChange, uploadedDocuments = [] }: KnowledgePreviewProps) {
  const [editingSection, setEditingSection] = useState<keyof KnowledgeBase | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<keyof KnowledgeBase | string>>(new Set());
  const [documentsCollapsed, setDocumentsCollapsed] = useState(false);

  const startEditing = (sectionKey: keyof KnowledgeBase) => {
    setEditingSection(sectionKey);
    setEditValue(knowledgeBase[sectionKey]);
  };

  const saveEdit = () => {
    if (editingSection) {
      onChange({
        ...knowledgeBase,
        [editingSection]: editValue
      });
      setEditingSection(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditValue('');
  };

  const toggleSection = (sectionKey: keyof KnowledgeBase) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionKey)) {
      newCollapsed.delete(sectionKey);
    } else {
      newCollapsed.add(sectionKey);
    }
    setCollapsedSections(newCollapsed);
  };

  const getCompletionPercentage = () => {
    const requiredSections = knowledgeSections.filter(section => section.required);
    const completedRequired = requiredSections.filter(section => 
      knowledgeBase[section.key].trim().length > 0
    ).length;
    
    const totalSections = knowledgeSections.filter(section => 
      knowledgeBase[section.key].trim().length > 0
    ).length;

    return {
      required: Math.round((completedRequired / requiredSections.length) * 100),
      total: Math.round((totalSections / knowledgeSections.length) * 100)
    };
  };

  const completion = getCompletionPercentage();

  return (
    <div className="space-y-6">
      {/* Completion Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Knowledge Base Completion Status
            <div className="flex items-center space-x-2">
              <Badge variant={completion.required === 100 ? "default" : "secondary"}>
                Required: {completion.required}%
              </Badge>
              <Badge variant="outline">
                Overall: {completion.total}%
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Review and edit the information extracted about your business. Required sections must be completed.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Uploaded Documents Section */}
      {uploadedDocuments.length > 0 && (
        <Card>
          <Collapsible open={!documentsCollapsed} onOpenChange={(open) => setDocumentsCollapsed(!open)}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Uploaded Documents ({uploadedDocuments.length})
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`w-4 h-4 transition-transform ${documentsCollapsed ? '' : 'rotate-180'}`} />
                  </Button>
                </CollapsibleTrigger>
              </CardTitle>
              <CardDescription>
                Documents that have been uploaded to enhance your knowledge base
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {uploadedDocuments.map((doc, index) => (
                   <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <div className="flex items-center gap-3">
                       <FileText className="w-4 h-4 text-muted-foreground" />
                       <div>
                         <p className="font-medium text-sm">{doc.customName || doc.originalName}</p>
                         {doc.customName && doc.originalName && (
                           <p className="text-xs text-muted-foreground">File: {doc.originalName}</p>
                         )}
                         <div className="flex items-center gap-2 text-xs text-muted-foreground">
                           <span>{doc.type}</span>
                           {doc.size && <span>• {Math.round(doc.size / 1024)} KB</span>}
                        </div>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                        )}
                       </div>
                     </div>
                     <Badge variant={doc.status === 'completed' ? 'default' : 'secondary'}>
                       {doc.status || 'uploaded'}
                     </Badge>
                   </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Knowledge Sections */}
      <div className="space-y-4">
        {knowledgeSections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.title}
                  {section.required && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  {knowledgeBase[section.key].trim().length === 0 && section.required && (
                    <Badge variant="outline" className="text-xs">Incomplete</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {editingSection === section.key ? (
                    <>
                      <Button size="sm" onClick={saveEdit}>
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => startEditing(section.key)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleSection(section.key)}
                      >
                        {collapsedSections.has(section.key) ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            
            {!collapsedSections.has(section.key) && (
              <CardContent>
                {editingSection === section.key ? (
                  <div className="space-y-2">
                    <Label htmlFor={section.key}>Edit {section.title}</Label>
                    <Textarea
                      id={section.key}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={section.placeholder}
                      className="min-h-[120px]"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {knowledgeBase[section.key].trim().length > 0 ? (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">
                          {knowledgeBase[section.key]}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed">
                        <p className="text-sm text-muted-foreground italic">
                          {section.placeholder}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Ready to Deploy?</CardTitle>
          <CardDescription>
            {completion.required === 100 
              ? "All required sections are complete. You can finalize your knowledge base and deploy your AI agents."
              : `Please complete the remaining required sections before finalizing. ${knowledgeSections.filter(s => s.required && knowledgeBase[s.key].trim().length === 0).length} required section(s) remaining.`
            }
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}