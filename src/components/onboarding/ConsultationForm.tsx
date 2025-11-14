import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Calendar, Building, DollarSign, Target, TrendingUp } from "lucide-react";
import { sendAdminOnboardingRequestEmail, createAdminOnboardingRequestData } from "@/lib/admin-email-service";

interface ConsultationFormData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companySize: string;
  industry: string;
  annualRevenue: string;
  businessBackground: string;
  goalsObjectives: string;
  currentChallenges: string;
  targetMarket: string;
  competitiveLandscape: string;
  preferredMeetingTimes: string;
  additionalNotes: string;
}

interface ConsultationFormProps {
  onComplete: () => void;
  companyId: string;
}

export function ConsultationForm({ onComplete, companyId }: ConsultationFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<ConsultationFormData>({
    contactName: "",
    contactEmail: user?.email || "",
    contactPhone: "",
    companySize: "",
    industry: "",
    annualRevenue: "",
    businessBackground: "",
    goalsObjectives: "",
    currentChallenges: "",
    targetMarket: "",
    competitiveLandscape: "",
    preferredMeetingTimes: "",
    additionalNotes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof ConsultationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("consultation_requests")
        .insert({
          company_id: companyId,
          user_id: user?.id,
          contact_name: formData.contactName,
          contact_email: formData.contactEmail,
          contact_phone: formData.contactPhone,
          company_size: formData.companySize,
          industry: formData.industry,
          annual_revenue: formData.annualRevenue,
          business_background: formData.businessBackground,
          goals_objectives: formData.goalsObjectives,
          current_challenges: formData.currentChallenges,
          target_market: formData.targetMarket,
          competitive_landscape: formData.competitiveLandscape,
          preferred_meeting_times: formData.preferredMeetingTimes,
          additional_notes: formData.additionalNotes,
        });

      if (error) throw error;

      // Update onboarding session
      await supabase
        .from("onboarding_sessions")
        .update({
          onboarding_type: "consulting",
          consultation_status: "requested",
          status: "completed",
          completed_at: new Date().toISOString(),
          session_data: formData as any,
        })
        .eq("user_id", user?.id);

      // Get company name for email
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();

      // Send admin notification email
      try {
        const requestDetails = `
Company: ${company?.name || 'Unknown Company'}
Contact: ${formData.contactName} (${formData.contactEmail})
Phone: ${formData.contactPhone}
Company Size: ${formData.companySize}
Industry: ${formData.industry}
Annual Revenue: ${formData.annualRevenue}

Business Background:
${formData.businessBackground}

Goals & Objectives:
${formData.goalsObjectives}

Current Challenges:
${formData.currentChallenges}

Target Market:
${formData.targetMarket}

Competitive Landscape:
${formData.competitiveLandscape}

Preferred Meeting Times:
${formData.preferredMeetingTimes}

Additional Notes:
${formData.additionalNotes}
        `.trim();

        const emailData = createAdminOnboardingRequestData(
          formData.contactName,
          formData.contactEmail,
          company?.name || 'Unknown Company',
          requestDetails
        );

        const emailResult = await sendAdminOnboardingRequestEmail(emailData);
        
        if (emailResult.success) {
          console.log(`Admin notification emails sent to: ${emailResult.sentTo.join(', ')}`);
          if (emailResult.error) {
            console.warn('Some admin emails failed:', emailResult.error);
          }
        } else {
          console.error('Failed to send admin notification emails:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Error sending admin notification email:', emailError);
        // Don't fail the form submission if email fails
      }

      // Send welcome email for custom onboarding
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user?.id)
          .single();

        const recipientName = profile?.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`.trim()
          : formData.contactName;

        await supabase.functions.invoke('send-email', {
          body: {
            type: 'welcome',
            data: {
              recipientEmail: formData.contactEmail,
              recipientName: recipientName,
              companyName: company?.name || 'Your Company',
              loginUrl: `${window.location.origin}/client-dashboard`,
              onboardingType: 'custom'
            }
          }
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the form submission if welcome email fails
      }

      toast.success("Consultation request submitted successfully!");
      // Redirect to client dashboard since onboarding is now complete
      window.location.href = '/client-dashboard';
    } catch (error: any) {
      toast.error("Failed to submit consultation request: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Consulting Service Request
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Our expert team will conduct comprehensive research about your business and create a detailed 70+ page knowledge base. 
          Please provide as much information as possible to help us prepare for our consultation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Primary contact details for scheduling and communication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Full Name *</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange("contactName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email Address *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone Number</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => handleInputChange("contactPhone", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Company Overview
            </CardTitle>
            <CardDescription>
              Basic information about your company size and market
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Company Size *</Label>
                <RadioGroup
                  value={formData.companySize}
                  onValueChange={(value) => handleInputChange("companySize", value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1-10" id="size-1-10" />
                    <Label htmlFor="size-1-10">1-10 employees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="11-50" id="size-11-50" />
                    <Label htmlFor="size-11-50">11-50 employees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="51-200" id="size-51-200" />
                    <Label htmlFor="size-51-200">51-200 employees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="200+" id="size-200-plus" />
                    <Label htmlFor="size-200-plus">200+ employees</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label>Annual Revenue</Label>
                <RadioGroup
                  value={formData.annualRevenue}
                  onValueChange={(value) => handleInputChange("annualRevenue", value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="<1M" id="revenue-1m" />
                    <Label htmlFor="revenue-1m">Less than $1M</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1M-10M" id="revenue-1m-10m" />
                    <Label htmlFor="revenue-1m-10m">$1M - $10M</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="10M-100M" id="revenue-10m-100m" />
                    <Label htmlFor="revenue-10m-100m">$10M - $100M</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="100M+" id="revenue-100m-plus" />
                    <Label htmlFor="revenue-100m-plus">$100M+</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Input
                id="industry"
                placeholder="e.g., Technology, Healthcare, Manufacturing"
                value={formData.industry}
                onChange={(e) => handleInputChange("industry", e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Business Analysis
            </CardTitle>
            <CardDescription>
              Detailed information to help us understand your business landscape
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessBackground">Business Background *</Label>
              <Textarea
                id="businessBackground"
                placeholder="Describe your business, what you do, your history, and current operations..."
                value={formData.businessBackground}
                onChange={(e) => handleInputChange("businessBackground", e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalsObjectives">Goals & Objectives *</Label>
              <Textarea
                id="goalsObjectives"
                placeholder="What are your primary business goals for the next 1-3 years?"
                value={formData.goalsObjectives}
                onChange={(e) => handleInputChange("goalsObjectives", e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentChallenges">Current Challenges *</Label>
              <Textarea
                id="currentChallenges"
                placeholder="What are the main challenges or pain points your business is facing?"
                value={formData.currentChallenges}
                onChange={(e) => handleInputChange("currentChallenges", e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetMarket">Target Market & Customers</Label>
              <Textarea
                id="targetMarket"
                placeholder="Describe your ideal customers, target demographics, and market segments..."
                value={formData.targetMarket}
                onChange={(e) => handleInputChange("targetMarket", e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="competitiveLandscape">Competitive Landscape</Label>
              <Textarea
                id="competitiveLandscape"
                placeholder="Who are your main competitors? What differentiates your business?"
                value={formData.competitiveLandscape}
                onChange={(e) => handleInputChange("competitiveLandscape", e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Meeting Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Meeting Preferences
            </CardTitle>
            <CardDescription>
              Help us schedule the best time for our consultation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredMeetingTimes">Preferred Meeting Times</Label>
              <Textarea
                id="preferredMeetingTimes"
                placeholder="e.g., Weekdays 9AM-5PM EST, Tuesday/Thursday afternoons, etc."
                value={formData.preferredMeetingTimes}
                onChange={(e) => handleInputChange("preferredMeetingTimes", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalNotes">Additional Notes</Label>
              <Textarea
                id="additionalNotes"
                placeholder="Any additional information or specific requirements..."
                value={formData.additionalNotes}
                onChange={(e) => handleInputChange("additionalNotes", e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-6">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="min-w-[200px]"
          >
            {isSubmitting ? "Submitting Request..." : "Request Consultation"}
          </Button>
        </div>
      </form>
    </div>
  );
}