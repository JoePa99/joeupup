import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
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
                  Welcome to Variable ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our knowledge management platform and services (the "Service").
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  This Privacy Policy complies with the General Data Protection Regulation (GDPR) and other applicable data protection laws. By using the Service, you consent to the data practices described in this policy.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  If you have questions or concerns about this Privacy Policy, please contact us at <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a>.
                </p>
              </section>

              {/* Information We Collect */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold mb-3 mt-4">2.1 Information You Provide</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We collect information that you voluntarily provide when using the Service, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Account Information:</strong> Name, email address, company name, and profile information</li>
                  <li><strong>Authentication Data:</strong> Login credentials and authentication tokens from third-party providers</li>
                  <li><strong>User Content:</strong> Documents, files, text, images, and other content you upload or create</li>
                  <li><strong>Communications:</strong> Messages, feedback, and correspondence with us or through the Service</li>
                  <li><strong>Team Information:</strong> Details about team members you invite to collaborate</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Information Collected Automatically</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you access the Service, we may automatically collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns</li>
                  <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
                  <li><strong>Log Data:</strong> IP address, access times, error logs, and diagnostic data</li>
                  <li><strong>Performance Data:</strong> Service performance metrics and error reports</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-4">2.3 Information from Third Parties</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We may receive information from third-party services you connect to Variable:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Google OAuth:</strong> Profile information, email address, and authentication tokens</li>
                  <li><strong>HubSpot:</strong> CRM data, contact information, and business activity data</li>
                  <li><strong>QuickBooks:</strong> Financial data, transaction records, and accounting information</li>
                  <li><strong>Shopify:</strong> E-commerce data, product information, and order details</li>
                </ul>
              </section>

              {/* How We Use Your Information */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use the collected information for the following purposes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Service Provision:</strong> To provide, maintain, and improve the Service functionality</li>
                  <li><strong>AI Processing:</strong> To process your content through AI agents powered by OpenAI for intelligent assistance</li>
                  <li><strong>Authentication:</strong> To verify your identity and manage your account access</li>
                  <li><strong>Communication:</strong> To send service-related notifications, updates, and respond to inquiries</li>
                  <li><strong>Collaboration:</strong> To enable team features and multi-user collaboration</li>
                  <li><strong>Integration Management:</strong> To facilitate connections with third-party services</li>
                  <li><strong>Analytics:</strong> To understand usage patterns and improve user experience</li>
                  <li><strong>Security:</strong> To detect, prevent, and address technical issues and security threats</li>
                  <li><strong>Compliance:</strong> To comply with legal obligations and enforce our Terms and Conditions</li>
                  <li><strong>Customer Support:</strong> To provide technical support and address user concerns</li>
                </ul>
              </section>

              {/* Legal Basis for Processing (GDPR) */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing (GDPR)</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Under GDPR, we process your personal data based on the following legal grounds:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Consent (Article 6(1)(a)):</strong> You have given explicit consent for specific processing activities</li>
                  <li><strong>Contract Performance (Article 6(1)(b)):</strong> Processing is necessary to provide the Service you requested</li>
                  <li><strong>Legal Obligation (Article 6(1)(c)):</strong> Processing is required to comply with applicable laws</li>
                  <li><strong>Legitimate Interests (Article 6(1)(f)):</strong> Processing is necessary for our legitimate business interests, such as improving the Service and ensuring security</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  You have the right to withdraw consent at any time, without affecting the lawfulness of processing based on consent before its withdrawal.
                </p>
              </section>

              {/* Data Sharing and Third-Party Services */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Third-Party Services</h2>
                
                <h3 className="text-xl font-semibold mb-3 mt-4">5.1 Third-Party Service Providers</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We share your information with trusted third-party service providers to operate the Service:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>OpenAI:</strong> We use OpenAI's artificial intelligence services to power our AI agents. Your content may be processed by OpenAI to provide intelligent responses and analysis. OpenAI's data usage is governed by their <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a> and <a href="https://openai.com/policies/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Use</a>.</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-4">5.2 Integration Services</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  When you connect third-party integrations, we share relevant data to enable functionality:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Google:</strong> Authentication and authorization services</li>
                  <li><strong>HubSpot:</strong> CRM integration and customer data synchronization</li>
                  <li><strong>QuickBooks:</strong> Financial data integration and accounting functions</li>
                  <li><strong>Shopify:</strong> E-commerce platform integration and order management</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Each integration's data handling is subject to their respective privacy policies. We recommend reviewing their policies before connecting these services.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-4">5.3 Legal Requirements</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may disclose your information if required by law, subpoena, or other legal process, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-4">5.4 Business Transfers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.
                </p>
              </section>

              {/* Data Security */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These measures include:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure data storage infrastructure</li>
                  <li>Employee training on data protection practices</li>
                  <li>Incident response procedures</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your personal data, we cannot guarantee absolute security.
                </p>
              </section>

              {/* Data Retention */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your personal data only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When determining retention periods, we consider:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                  <li>The nature and sensitivity of the data</li>
                  <li>The purposes for which we process the data</li>
                  <li>Legal and regulatory retention requirements</li>
                  <li>Potential legal claims and disputes</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  When you delete your account, we will delete or anonymize your personal data unless retention is required for legal compliance, dispute resolution, or enforcement of our agreements.
                </p>
              </section>

              {/* Your Rights Under GDPR */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Your Rights Under GDPR</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you are located in the European Economic Area (EEA), you have the following rights regarding your personal data:
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-foreground">Right of Access (Article 15)</h4>
                    <p className="text-muted-foreground">You have the right to request copies of your personal data.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Rectification (Article 16)</h4>
                    <p className="text-muted-foreground">You have the right to request correction of inaccurate or incomplete data.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Erasure (Article 17)</h4>
                    <p className="text-muted-foreground">You have the right to request deletion of your personal data under certain circumstances.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Restrict Processing (Article 18)</h4>
                    <p className="text-muted-foreground">You have the right to request restriction of processing of your personal data.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Data Portability (Article 20)</h4>
                    <p className="text-muted-foreground">You have the right to request transfer of your data to another service provider.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Object (Article 21)</h4>
                    <p className="text-muted-foreground">You have the right to object to processing based on legitimate interests.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Withdraw Consent (Article 7)</h4>
                    <p className="text-muted-foreground">Where processing is based on consent, you have the right to withdraw it at any time.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-foreground">Right to Lodge a Complaint</h4>
                    <p className="text-muted-foreground">You have the right to lodge a complaint with a supervisory authority in your jurisdiction.</p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise any of these rights, please contact us at <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a>. We will respond to your request within 30 days as required by GDPR.
                </p>
              </section>

              {/* International Data Transfers */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your jurisdiction.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  When we transfer personal data from the EEA to other countries, we ensure appropriate safeguards are in place, such as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                  <li>Standard Contractual Clauses approved by the European Commission</li>
                  <li>Adequacy decisions regarding the recipient country</li>
                  <li>Other legally recognized transfer mechanisms</li>
                </ul>
              </section>

              {/* Children's Privacy */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service is not intended for individuals under the age of 16. We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal data, please contact us immediately, and we will take steps to delete such information.
                </p>
              </section>

              {/* Cookies and Tracking */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Currently, the Service does not use cookies or tracking technologies for analytics or advertising purposes. We use only essential session management mechanisms necessary for authentication and service functionality. Should this change in the future, we will update this Privacy Policy and provide appropriate notice and consent mechanisms.
                </p>
              </section>

              {/* Changes to Privacy Policy */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any material changes by:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                  <li>Posting the updated policy on this page with a new "Last Updated" date</li>
                  <li>Sending an email notification to your registered email address</li>
                  <li>Displaying a prominent notice within the Service</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  Your continued use of the Service after any changes constitutes acceptance of the updated Privacy Policy. We encourage you to review this Privacy Policy periodically.
                </p>
              </section>

              {/* Contact Information */}
              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
                </p>
                <div className="mt-3 p-4 bg-muted rounded-lg">
                  <p className="font-semibold">Variable - Data Protection</p>
                  <p className="text-muted-foreground">Email: <a href="mailto:hello@variable.ai" className="text-primary hover:underline">hello@variable.ai</a></p>
                  <p className="text-sm text-muted-foreground mt-2">For GDPR-related inquiries, please include "GDPR Request" in your email subject line.</p>
                </div>
              </section>

              {/* Acknowledgment */}
              <section className="border-t pt-6 mt-8">
                <p className="text-sm text-muted-foreground italic">
                  By using Variable's Service, you acknowledge that you have read and understood this Privacy Policy and agree to the collection, use, and disclosure of your information as described herein.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;

