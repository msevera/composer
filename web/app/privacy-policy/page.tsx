import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - Composer AI',
  description: 'Privacy Policy for Composer AI - Learn how we collect, use, and protect your data in compliance with GDPR.',
};

const LAST_UPDATED = 'January 2025';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link href="/" className="text-2xl font-serif text-slate-900 hover:text-slate-700">
            Composer AI
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="space-y-8">
          {/* Header Section */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-sm text-slate-500">Last Updated: {LAST_UPDATED}</p>
            <p className="text-base text-slate-700">
              This Privacy Policy describes how Composer AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses, and protects your personal information when you use our AI-powered email composition service. By using Composer AI, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          {/* Section 1: Information We Collect */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">1. Information We Collect</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>We collect the following types of information:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Account Information:</strong> Email address, name, and other information you provide during registration</li>
                <li><strong>Gmail Thread Content:</strong> Full email threads when you use the compose feature to generate AI-powered responses</li>
                <li><strong>Usage Data:</strong> Draft count, feature usage statistics, and interaction patterns with our service</li>
                <li><strong>Technical Data:</strong> Browser type, device information, IP address, and other technical identifiers</li>
                <li><strong>Analytics Data:</strong> Behavioral analytics and usage tracking collected via Segment</li>
              </ul>
            </div>
          </section>

          {/* Section 2: How We Use Your Information */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">2. How We Use Your Information</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>We use the collected information for the following purposes:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>To provide and maintain our AI-powered email composition service</li>
                <li>To manage and enforce usage limits (including the 20 draft limit tracking)</li>
                <li>To authenticate and secure your account</li>
                <li>To improve service performance, reliability, and user experience</li>
                <li>To communicate service updates and important information (if you have opted in)</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Third-Party Data Processing */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">3. Third-Party Data Processing</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p className="font-semibold text-slate-900">We share your data with the following third-party services:</p>
              <ul className="ml-6 list-disc space-y-3">
                <li>
                  <strong>OpenAI API:</strong> Email thread content and user prompts are sent to OpenAI for AI processing. 
                  OpenAI retains this data for a maximum of 30 days and does not use it for model training. 
                  Data is processed in the United States.
                </li>
                <li>
                  <strong>LangSmith (LangChain):</strong> Full conversation and email content is logged to LangSmith for debugging and service improvement purposes. 
                  LangSmith automatically deletes this data after 14 days. Data is processed in the United States.
                </li>
                <li>
                  <strong>Segment Analytics:</strong> We use Segment to collect behavioral analytics and usage tracking data to understand how our service is used and to improve it.
                </li>
                <li>
                  <strong>Google APIs:</strong> We integrate with Google APIs to read email threads from your Gmail account when you use the compose feature. 
                  This integration is subject to Google&apos;s privacy policies.
                </li>
              </ul>
              <p className="mt-4">
                <strong>Important:</strong> All third-party services mentioned above are based in the United States. 
                By using our service, you acknowledge that your data may be transferred to and processed in the United States.
              </p>
            </div>
          </section>

          {/* Section 4: Data Retention and Deletion */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">4. Data Retention and Deletion</h2>
            <div className="space-y-3 text-base text-slate-700">
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Account Data:</strong> Your account data is stored in MongoDB (US region) and retained until you delete your account.</li>
                <li><strong>Account Deletion:</strong> Upon account deletion, your data is immediately removed from our MongoDB database.</li>
                <li><strong>Third-Party Retention:</strong> 
                  <ul className="ml-6 mt-2 list-disc space-y-1">
                    <li>OpenAI: Maximum 30 days (automatic deletion)</li>
                    <li>LangSmith: Maximum 14 days (automatic deletion)</li>
                  </ul>
                </li>
                <li><strong>Note:</strong> Data stored with third-party services cannot be manually deleted by us, but it automatically expires according to the retention policies stated above.</li>
              </ul>
            </div>
          </section>

          {/* Section 5: Your Rights (GDPR Compliance) */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">5. Your Rights (GDPR Compliance)</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>If you are located in the European Economic Area (EEA) or United Kingdom, you have the following rights regarding your personal data:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Right to Access:</strong> You have the right to request access to your personal data that we hold.</li>
                <li><strong>Right to Deletion:</strong> You have the right to request deletion of your account and associated personal data.</li>
                <li><strong>Right to Data Portability:</strong> You have the right to receive your personal data in a structured, commonly used, and machine-readable format.</li>
                <li><strong>Right to Withdraw Consent:</strong> You have the right to withdraw your consent to data processing at any time.</li>
                <li><strong>Right to Object:</strong> You have the right to object to the processing of your personal data in certain circumstances.</li>
                <li><strong>Right to Lodge a Complaint:</strong> You have the right to lodge a complaint with a supervisory authority if you believe your data protection rights have been violated.</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, please contact us at:{' '}
                <a href="mailto:michael.svr@gmail.com" className="text-blue-600 underline hover:text-blue-700">
                  michael.svr@gmail.com
                </a>
              </p>
            </div>
          </section>

          {/* Section 6: Data Security */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">6. Data Security</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>We implement appropriate technical and organizational measures to protect your personal data:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Data encryption in transit using HTTPS/TLS protocols</li>
                <li>Secure authentication via Better Auth</li>
                <li>Access controls and authentication requirements</li>
                <li>Regular security assessments and updates</li>
              </ul>
              <p className="mt-4">
                <strong>Beta Service Notice:</strong> Composer AI is currently in beta. While we implement security best practices, 
                we are continuously improving our security measures. We recommend that you do not use this service for highly sensitive or confidential communications.
              </p>
            </div>
          </section>

          {/* Section 7: International Data Transfers */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">7. International Data Transfers</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                Your personal data is processed in the United States. If you are located outside the United States, 
                including in the European Union or Poland, your data will be transferred to and processed in the United States.
              </p>
              <p>
                We ensure that appropriate safeguards are in place for such transfers, including standard contractual clauses 
                where applicable, to protect your personal data in accordance with applicable data protection laws.
              </p>
            </div>
          </section>

          {/* Section 8: Cookies and Tracking */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">8. Cookies and Tracking</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>We use the following types of cookies and tracking technologies:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Authentication Cookies:</strong> Essential cookies for maintaining your login session</li>
                <li><strong>Session Management:</strong> Cookies that help manage your session and preferences</li>
                <li><strong>Analytics Tracking:</strong> We use Segment Analytics to track usage patterns and improve our service</li>
              </ul>
              <p className="mt-4">
                You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of our service.
              </p>
            </div>
          </section>

          {/* Section 9: Children's Privacy */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">9. Children&apos;s Privacy</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                Composer AI is restricted to users who are 18 years of age or older. We do not knowingly collect personal information 
                from individuals under 18 years of age. If we become aware that we have collected personal information from a minor, 
                we will take steps to delete such information promptly.
              </p>
            </div>
          </section>

          {/* Section 10: Changes to Privacy Policy */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">10. Changes to Privacy Policy</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                We reserve the right to update this Privacy Policy at any time. We will notify you of any material changes by 
                updating the &quot;Last Updated&quot; date at the top of this page or by sending you an email notification.
              </p>
              <p>
                Your continued use of Composer AI after any changes to this Privacy Policy constitutes your acceptance of the updated policy. 
                We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.
              </p>
            </div>
          </section>

          {/* Section 11: Contact Information */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">11. Contact Information</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:michael.svr@gmail.com" className="text-blue-600 underline hover:text-blue-700">
                    michael.svr@gmail.com
                  </a>
                </li>
                <li><strong>Service Operator:</strong> Composer AI (individual operator, Poland)</li>
              </ul>
            </div>
          </section>

          {/* Footer Navigation */}
          <div className="mt-12 border-t border-slate-200 pt-8">
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <Link href="/terms-of-use" className="text-blue-600 hover:text-blue-700 underline">
                Terms of Use
              </Link>
              <Link href="/privacy-policy" className="text-blue-600 hover:text-blue-700 underline">
                Privacy Policy
              </Link>
              <Link href="/signup" className="text-blue-600 hover:text-blue-700 underline">
                Sign Up
              </Link>
              <Link href="/login" className="text-blue-600 hover:text-blue-700 underline">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

