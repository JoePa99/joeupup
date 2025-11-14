import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-3xl font-bold">Terms and Conditions</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last Updated: October 2, 2025
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none p-6">
            <div className="space-y-8">
              {/* Introduction */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Welcome to Variable ("we," "our," or "us"). These Terms and Conditions ("Terms") govern your access to and use of Variable's knowledge management platform and related services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  For questions or concerns regarding these Terms, please contact us at <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a>.
                </p>
              </section>

              {/* Account Registration */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Account Registration and User Responsibilities</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  To access certain features of the Service, you may be required to create an account. When creating an account, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security and confidentiality of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access or security breach</li>
                  <li>Accept responsibility for all activities that occur under your account</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You may not create an account using false information or on behalf of someone other than yourself without authorization.
                </p>
              </section>

              {/* Service Description */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Service Description</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Variable provides an AI-powered knowledge management platform that enables users to organize, analyze, and interact with their business information. The Service includes features such as document management, AI agent assistance, team collaboration tools, and integrations with third-party services.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Currently, Variable is provided as a free service. We reserve the right to introduce paid features or subscription plans in the future, with reasonable notice to users.
                </p>
              </section>

              {/* Acceptable Use */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use Policy</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Use the Service in any manner that violates any applicable law or regulation</li>
                  <li>Engage in any activity that interferes with or disrupts the Service</li>
                  <li>Attempt to gain unauthorized access to any portion of the Service or any other systems or networks</li>
                  <li>Upload, transmit, or distribute any viruses, malware, or malicious code</li>
                  <li>Use the Service to harass, abuse, or harm another person or entity</li>
                  <li>Impersonate any person or entity or falsely state or misrepresent your affiliation</li>
                  <li>Engage in any data mining, scraping, or similar data gathering activities</li>
                  <li>Use the Service to transmit spam, chain letters, or other unsolicited communications</li>
                  <li>Upload or share content that infringes upon intellectual property rights of others</li>
                  <li>Use the Service for any illegal or fraudulent purposes</li>
                </ul>
              </section>

              {/* Third-Party Integrations */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Third-Party Integrations</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  The Service integrates with various third-party services to enhance functionality, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>OpenAI:</strong> AI and machine learning capabilities for intelligent agent interactions</li>
                  <li><strong>Google OAuth:</strong> Authentication and authorization services</li>
                  <li><strong>HubSpot:</strong> CRM integration for customer relationship management</li>
                  <li><strong>QuickBooks:</strong> Accounting and financial data integration</li>
                  <li><strong>Shopify:</strong> E-commerce platform integration</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Your use of these third-party services is subject to their respective terms of service and privacy policies. We are not responsible for the practices, content, or services of any third parties. You acknowledge that we may share certain data with these services to provide integrated functionality.
                </p>
              </section>

              {/* Intellectual Property */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property Rights</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong>Our Rights:</strong> The Service, including its original content, features, and functionality, is owned by Variable and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. Our trademarks and trade dress may not be used without our prior written consent.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>Your Rights:</strong> You retain all rights to the content, documents, and data you upload to the Service ("User Content"). By uploading User Content, you grant us a limited, non-exclusive, royalty-free license to use, store, process, and display your User Content solely for the purpose of providing and improving the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong>AI-Generated Content:</strong> Content generated by AI agents through the Service may be used by you in accordance with these Terms. However, you acknowledge that AI-generated content should be reviewed for accuracy and appropriateness before use.
                </p>
              </section>

              {/* Privacy and Data Protection */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Privacy and Data Protection</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your privacy is important to us. Our collection, use, and protection of your personal data is governed by our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your information as described in the Privacy Policy.
                </p>
              </section>

              {/* Service Availability */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Service Availability and Modifications</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We strive to provide reliable access to the Service but do not guarantee that the Service will be available at all times or error-free. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. We may also impose limits on certain features or restrict access to parts of the Service without notice or liability.
                </p>
              </section>

              {/* Disclaimer of Warranties */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground leading-relaxed">
                  THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  WE DO NOT WARRANT THAT:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                  <li>The Service will meet your specific requirements or expectations</li>
                  <li>The Service will be uninterrupted, timely, secure, or error-free</li>
                  <li>The results obtained from using the Service will be accurate or reliable</li>
                  <li>Any errors in the Service will be corrected</li>
                  <li>AI-generated content will be accurate, complete, or suitable for any particular purpose</li>
                </ul>
              </section>

              {/* Limitation of Liability */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VARIABLE, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-2">
                  <li>Your access to or use of or inability to access or use the Service</li>
                  <li>Any conduct or content of any third party on the Service</li>
                  <li>Any content obtained from the Service</li>
                  <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                </ul>
              </section>

              {/* Indemnification */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless Variable and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your violation of any rights of another party.
                </p>
              </section>

              {/* Termination */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You may terminate your account at any time by contacting us at <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a>. Upon termination, we will make reasonable efforts to delete your data in accordance with our Privacy Policy, subject to legal retention requirements.
                </p>
              </section>

              {/* Governing Law */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Governing Law and Dispute Resolution</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with applicable international laws. For users in the European Union, these Terms comply with the General Data Protection Regulation (GDPR) and other applicable European laws.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Any disputes arising from these Terms or your use of the Service shall be resolved through good faith negotiations. If a dispute cannot be resolved informally, you agree to submit to the exclusive jurisdiction of the courts in the appropriate jurisdiction based on your location.
                </p>
              </section>

              {/* Changes to Terms */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify or replace these Terms at any time at our sole discretion. If we make material changes, we will provide notice through the Service or by email. Your continued use of the Service after any changes constitutes acceptance of the new Terms.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  We encourage you to review these Terms periodically for any updates or changes.
                </p>
              </section>

              {/* Severability */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Severability and Waiver</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
                </p>
              </section>

              {/* Entire Agreement */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">16. Entire Agreement</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and Variable regarding the use of the Service and supersede all prior agreements and understandings, whether written or oral.
                </p>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">17. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions, concerns, or complaints regarding these Terms, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="font-semibold">Variable</p>
                  <p className="text-muted-foreground">Email: <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a></p>
                </div>
              </section>

              {/* Acknowledgment */}
              <section className="border-t pt-6 mt-8">
                <p className="text-sm text-muted-foreground italic">
                  By using Variable's Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;

