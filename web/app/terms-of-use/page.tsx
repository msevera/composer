import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use - Composer AI',
  description: 'Terms of Use for Composer AI - Read our service terms, usage policies, and user agreements.',
};

const LAST_UPDATED = 'January 2025';

export default function TermsOfUsePage() {
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
            <h1 className="text-4xl font-bold text-slate-900">Terms of Use</h1>
            <p className="text-sm text-slate-500">Last Updated: {LAST_UPDATED}</p>
            <p className="text-base text-slate-700">
              These Terms of Use (&quot;Terms&quot;) govern your access to and use of Composer AI, a beta AI-powered email composition service. 
              By accessing or using Composer AI, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use our service.
            </p>
          </div>

          {/* Section 1: Service Description */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">1. Service Description</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>Composer AI is a beta AI-powered email composition tool that helps users generate email drafts using artificial intelligence. Our service includes:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>A Gmail browser extension for accessing the service directly from your email</li>
                <li>A web application for managing your account and settings</li>
                <li>AI-powered email composition features</li>
              </ul>
              <p className="mt-4">
                <strong>Beta Service Notice:</strong> Composer AI is currently in beta and is an experimental service. 
                The service may be discontinued, modified, or changed at any time without notice. 
                We do not provide service level agreements (SLAs) or uptime guarantees.
              </p>
            </div>
          </section>

          {/* Section 2: Beta Service Disclaimer */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">2. Beta Service Disclaimer</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>Composer AI is provided &quot;AS-IS&quot; for testing and evaluation purposes. By using this service, you acknowledge that:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>The service may contain bugs, errors, or interruptions</li>
                <li>Features may change, be modified, or removed without notice</li>
                <li>The service may be discontinued at any time</li>
                <li>No warranties, express or implied, are provided</li>
                <li>We have limited liability for service failures, data loss, or interruptions</li>
                <li>You assume all risks associated with using an experimental AI service</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Eligibility */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">3. Eligibility</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>To use Composer AI, you must:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Be at least 18 years of age</li>
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and update your registration information to keep it accurate</li>
                <li>Maintain only one account per user</li>
              </ul>
              <p className="mt-4">
                We reserve the right to refuse service, terminate accounts, or limit access to our service at our sole discretion, 
                with or without notice, for any reason, including violation of these Terms.
              </p>
            </div>
          </section>

          {/* Section 4: Account and Authentication */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">4. Account and Authentication</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>You are responsible for:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized access or use of your account</li>
                <li>Ensuring that you exit from your account at the end of each session</li>
              </ul>
              <p className="mt-4">
                Your account is non-transferable. You may not share, sell, or otherwise transfer your account to any other person or entity.
              </p>
            </div>
          </section>

          {/* Section 5: Usage Limits and Pricing */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">5. Usage Limits and Pricing</h2>
            <div className="space-y-3 text-base text-slate-700">
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Free Beta Tier:</strong> The free beta tier includes 20 draft compositions per account.</li>
                <li><strong>Limit Increases:</strong> To request a manual limit increase, please contact us at{' '}
                  <a href="mailto:michael.svr@gmail.com" className="text-blue-600 underline hover:text-blue-700">
                    michael.svr@gmail.com
                  </a>
                </li>
                <li><strong>Pricing Changes:</strong> Our pricing model is subject to change after we achieve product-market fit. 
                  We will provide notice of any pricing changes before they take effect.</li>
                <li><strong>Refunds:</strong> If paid tiers are implemented in the future, refunds will not be available unless required by applicable law.</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Content Ownership and Intellectual Property */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">6. Content Ownership and Intellectual Property</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p className="font-semibold text-slate-900">User Content Ownership:</p>
              <p>
                You retain full ownership of all content you input into Composer AI, including prompts, email threads, and any other data you provide. 
                You also retain full ownership of all AI-generated outputs created using our service.
              </p>
              <p className="mt-4 font-semibold text-slate-900">Composer AI Intellectual Property:</p>
              <p>
                Composer AI retains ownership of all software, AI models, platform technology, trademarks, logos, and other intellectual property 
                associated with our service.
              </p>
              <p className="mt-4 font-semibold text-slate-900">License Grant:</p>
              <p>
                By using our service, you grant Composer AI a limited, non-exclusive, royalty-free license to process, store, and use your content 
                solely for the purpose of providing and improving the service. We do not claim ownership of your content beyond what is necessary 
                to provide the service.
              </p>
            </div>
          </section>

          {/* Section 7: AI-Generated Content Disclaimer */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">7. AI-Generated Content Disclaimer</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>You acknowledge and agree that:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>AI-generated content may be inaccurate, incomplete, or inappropriate</li>
                <li>You must review all AI-generated outputs before using, sending, or publishing them</li>
                <li>You are solely responsible for all content you send, publish, or otherwise use, regardless of whether it was AI-generated</li>
                <li>We do not guarantee the accuracy, quality, or suitability of any AI-generated content</li>
                <li>AI-generated content is not a substitute for professional advice, legal counsel, or other expert services</li>
                <li>You should not rely solely on AI-generated content for important decisions or communications</li>
              </ul>
            </div>
          </section>

          {/* Section 8: Acceptable Use Policy */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">8. Acceptable Use Policy</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>You agree not to use Composer AI for any of the following prohibited activities:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Any illegal content or activities, or to facilitate illegal activities</li>
                <li>Harassment, hate speech, threats, or any content that promotes violence or discrimination</li>
                <li>Spam, unsolicited communications, or any form of bulk messaging</li>
                <li>Attempts to breach, circumvent, or compromise the security of our service or systems</li>
                <li>Reverse engineering, decompiling, or attempting to extract the source code of our service</li>
                <li>Unauthorized access to any part of our service, accounts, or systems</li>
                <li>Violation of any third-party rights, including intellectual property rights, privacy rights, or other legal rights</li>
                <li>Abuse of the service, including excessive usage beyond stated limits or attempts to circumvent usage restrictions</li>
                <li>Any activity that could harm, disable, or impair our service or interfere with other users&apos; access</li>
              </ul>
              <p className="mt-4">
                Violation of this Acceptable Use Policy may result in immediate termination of your account and access to the service.
              </p>
            </div>
          </section>

          {/* Section 9: Limitation of Liability */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">9. Limitation of Liability</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, COMPOSER AI IS PROVIDED &quot;AS-IS&quot; AND &quot;AS-AVAILABLE&quot; WITHOUT WARRANTIES 
                OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
                PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>We shall not be liable for:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Service interruptions, downtime, or unavailability</li>
                <li>Loss of data, content, or information</li>
                <li>Errors, inaccuracies, or omissions in AI-generated content</li>
                <li>Indirect, incidental, special, consequential, or punitive damages</li>
                <li>Loss of profits, revenue, business opportunities, or goodwill</li>
              </ul>
              <p className="mt-4">
                Our maximum liability to you for any claims arising out of or relating to these Terms or the service shall not exceed the amount 
                you have paid to us (currently $0 for the beta service).
              </p>
              <p>
                You assume all risks associated with using an experimental AI service, including but not limited to risks related to accuracy, 
                reliability, and data security.
              </p>
            </div>
          </section>

          {/* Section 10: Indemnification */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">10. Indemnification</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                You agree to indemnify, defend, and hold harmless Composer AI, its operators, and affiliates from and against any and all claims, 
                damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Your use of the service</li>
                <li>Content you create, upload, or share through the service</li>
                <li>Your violation of these Terms or any applicable laws or regulations</li>
                <li>Any third-party claims arising from your use of the service or content</li>
                <li>Your violation of any rights of another party</li>
              </ul>
            </div>
          </section>

          {/* Section 11: Termination */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">11. Termination</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p className="font-semibold text-slate-900">Termination by You:</p>
              <p>You may delete your account and discontinue use of the service at any time.</p>
              <p className="mt-4 font-semibold text-slate-900">Termination by Us:</p>
              <p>We may suspend or terminate your access to the service, with or without notice, for any reason, including:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Violation of these Terms</li>
                <li>Illegal activity or suspected illegal activity</li>
                <li>Abuse of the service or violation of the Acceptable Use Policy</li>
                <li>Any other reason we deem necessary (as a beta service, we reserve broad discretion)</li>
              </ul>
              <p className="mt-4">
                Upon termination, your right to use the service will immediately cease. We will delete your data in accordance with our Privacy Policy. 
                Provisions of these Terms that by their nature should survive termination shall survive, including but not limited to ownership provisions, 
                warranty disclaimers, indemnity, and limitations of liability.
              </p>
            </div>
          </section>

          {/* Section 12: Modifications to Terms */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">12. Modifications to Terms</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any material changes by:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Updating the &quot;Last Updated&quot; date at the top of this page</li>
                <li>Sending you an email notification (if you have provided an email address)</li>
                <li>Displaying a notice within the service</li>
              </ul>
              <p className="mt-4">
                Your continued use of Composer AI after any changes to these Terms constitutes your acceptance of the modified Terms. 
                If you do not agree to the modified Terms, you must stop using the service and delete your account.
              </p>
              <p>
                We encourage you to review these Terms periodically to stay informed about your rights and obligations.
              </p>
            </div>
          </section>

          {/* Section 13: Governing Law and Disputes */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">13. Governing Law and Disputes</h2>
            <div className="space-y-3 text-base text-slate-700">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of Poland, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising out of or relating to these Terms or the service shall be subject to the exclusive jurisdiction of the courts 
                of Warsaw, Poland.
              </p>
              <p className="mt-4">
                Before initiating any formal legal proceedings, we encourage you to contact us at{' '}
                <a href="mailto:michael.svr@gmail.com" className="text-blue-600 underline hover:text-blue-700">
                  michael.svr@gmail.com
                </a>{' '}
                to attempt to resolve any disputes informally.
              </p>
              <p>
                <strong>Class Action Waiver:</strong> To the extent permitted by applicable law, you agree that any disputes will be resolved on an 
                individual basis and that you will not participate in any class action, collective action, or representative proceeding.
              </p>
            </div>
          </section>

          {/* Section 14: General Provisions */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">14. General Provisions</h2>
            <div className="space-y-3 text-base text-slate-700">
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
                  Composer AI regarding the service and supersede all prior agreements and understandings.</li>
                <li><strong>Severability:</strong> If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions 
                  shall continue in full force and effect.</li>
                <li><strong>No Waiver:</strong> Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such 
                  right or provision.</li>
                <li><strong>Assignment:</strong> You may not assign or transfer these Terms or your account without our prior written consent. 
                  We may assign these Terms without restriction.</li>
                <li><strong>Force Majeure:</strong> We shall not be liable for any failure or delay in performance due to circumstances beyond our 
                  reasonable control, including but not limited to natural disasters, war, terrorism, labor disputes, or internet failures.</li>
              </ul>
              <p className="mt-4">
                If you have any questions about these Terms, please contact us at:{' '}
                <a href="mailto:michael.svr@gmail.com" className="text-blue-600 underline hover:text-blue-700">
                  michael.svr@gmail.com
                </a>
              </p>
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

