# Privacy Policy and Terms of Use Implementation Plan

## Overview
This plan outlines the implementation of GDPR-compliant Privacy Policy and Terms of Use pages for Composer AI, a beta AI-powered email composition tool. The implementation will create two new public routes in the Next.js web application that clearly disclose data practices, third-party processing, user rights, and service terms while maintaining consistency with the existing application design.

## Core Components

### 1. Route Structure
Create two new pages in the Next.js app directory:
- `web/app/privacy-policy/page.tsx` - Privacy Policy page
- `web/app/terms-of-use/page.tsx` - Terms of Use page

Both pages should be publicly accessible (no authentication required) and follow the existing app directory routing conventions.

### 2. Privacy Policy Content Structure

**Header Section:**
- Page title: "Privacy Policy"
- Last updated date (e.g., "Last Updated: [Date]")
- Brief introduction to Composer AI service

**Section 1: Information We Collect**
- Account information (email address, name)
- Gmail thread content (full email threads when using compose feature)
- Usage data (draft count, feature usage)
- Technical data (browser type, device information)
- Analytics data via Segment

**Section 2: How We Use Your Information**
- To provide AI-powered email composition service
- To manage usage limits (20 draft limit tracking)
- To authenticate and secure your account
- To improve service performance and reliability
- To communicate service updates (if opted in)

**Section 3: Third-Party Data Processing (Critical Disclosure)**
- **OpenAI API**: Email thread content and user prompts sent for AI processing; 30-day retention policy; not used for model training
- **LangSmith (LangChain)**: Full conversation and email content logged for debugging; 14-day automatic deletion
- **Segment Analytics**: Behavioral analytics and usage tracking
- **Google APIs**: Gmail integration for reading email threads
- Clarify that data is transferred to US-based services

**Section 4: Data Retention and Deletion**
- Account data stored in MongoDB (US region) until user deletes account
- Upon account deletion: immediate removal from MongoDB
- Third-party retention: OpenAI (max 30 days), LangSmith (max 14 days)
- Note that data cannot be manually deleted from third-party systems but auto-expires

**Section 5: Your Rights (GDPR Compliance)**
- Right to access your personal data
- Right to delete your account and data
- Right to data portability
- Right to withdraw consent
- Right to object to processing
- Right to lodge a complaint with supervisory authority
- Contact email for privacy requests: michael.svr@gmail.com

**Section 6: Data Security**
- Security measures in transit and at rest
- Authentication via Better Auth
- Note: Beta service with ongoing security improvements

**Section 7: International Data Transfers**
- Data processed in United States
- User data from Poland/EU transferred to US services
- Standard contractual clauses where applicable

**Section 8: Cookies and Tracking**
- Authentication cookies
- Session management
- Analytics tracking via Segment

**Section 9: Children's Privacy**
- Service restricted to users 18 years and older
- No knowing collection of data from minors

**Section 10: Changes to Privacy Policy**
- Right to update policy with notice
- Last updated date maintained at top
- Continued use constitutes acceptance

**Section 11: Contact Information**
- Email: michael.svr@gmail.com
- Service operated by: Composer AI (individual operator, Poland)

### 3. Terms of Use Content Structure

**Header Section:**
- Page title: "Terms of Use"
- Last updated date
- Agreement to terms by using service

**Section 1: Service Description**
- Composer AI: Beta AI-powered email composition tool
- Experimental service that may discontinue
- Gmail browser extension and web application
- No service level agreements or uptime guarantees

**Section 2: Beta Service Disclaimer**
- Provided "AS-IS" for testing and evaluation
- May contain bugs, errors, or interruptions
- Features may change without notice
- Service may be discontinued at any time
- No warranties express or implied
- Limited liability for service failures

**Section 3: Eligibility**
- Must be 18 years or older
- Must provide accurate registration information
- One account per user
- Right to refuse or terminate service

**Section 4: Account and Authentication**
- User responsible for account security
- Must maintain confidential credentials
- Notify of unauthorized access
- Account is non-transferable

**Section 5: Usage Limits and Pricing**
- Free beta tier: 20 draft compositions
- Manual limit increase: contact michael.svr@gmail.com
- Pricing model subject to change after product-market fit
- No refunds for future paid tiers (when implemented)

**Section 6: Content Ownership and Intellectual Property**
- **User owns all content**: You retain full ownership of input prompts and AI-generated outputs
- Composer AI retains ownership of: software, AI models, platform technology, trademarks
- License grant: User grants Composer AI limited license to process content solely to provide service
- No claim to user content beyond service provision

**Section 7: AI-Generated Content Disclaimer**
- AI may produce inaccurate, incomplete, or inappropriate content
- User must review all AI outputs before use
- User responsible for content they send/publish
- No guarantee of accuracy, quality, or suitability
- Not a substitute for professional advice

**Section 8: Acceptable Use Policy**
- Prohibited activities:
  - Illegal content or activities
  - Harassment, hate speech, or threats
  - Spam or unsolicited communications
  - Attempts to breach security
  - Reverse engineering or unauthorized access
  - Violation of third-party rights
  - Abuse of service or excessive usage beyond limits

**Section 9: Limitation of Liability**
- Service provided "AS-IS" without warranties
- No liability for: service interruptions, data loss, AI errors, indirect/consequential damages
- Maximum liability limited to amount paid (currently $0 for beta)
- User assumes all risks of using experimental AI service

**Section 10: Indemnification**
- User agrees to indemnify Composer AI for:
  - Their use of the service
  - Content they create or share
  - Violation of terms or laws
  - Third-party claims arising from their use

**Section 11: Termination**
- User may delete account at any time
- Composer AI may suspend/terminate for:
  - Terms violation
  - Illegal activity
  - Abuse of service
  - Any reason with notice (beta service)
- Effect of termination: data deletion per Privacy Policy

**Section 12: Modifications to Terms**
- Right to modify terms at any time
- Notice of material changes via email or service notification
- Continued use after changes constitutes acceptance
- User should review terms periodically

**Section 13: Governing Law and Disputes**
- Governed by laws of Poland
- Jurisdiction: Warsaw, Poland
- Informal resolution encouraged before formal action
- No class action waiver (preserving user rights)

**Section 14: General Provisions**
- Entire agreement
- Severability clause
- No waiver of rights
- Assignment restrictions
- Force majeure
- Contact for questions: michael.svr@gmail.com

### 4. Technical Implementation

**Page Components:**
- Use existing Tailwind CSS utility classes
- Follow layout patterns from other pages (e.g., login, signup)
- Responsive design for mobile and desktop
- Typography hierarchy: h1 for page title, h2 for sections, h3 for subsections
- Consistent spacing and padding
- Last updated date component at top

**Styling Approach:**
- Maximum width container for readability (e.g., `max-w-4xl mx-auto`)
- Proper spacing between sections (`space-y-8` or similar)
- Clear section headers with appropriate font weight
- Readable font size for legal text (e.g., `text-base` or `text-sm`)
- Link styling for contact emails (underline, color)
- Print-friendly styles (optional but recommended)

**Navigation Integration:**
- Add links to footer (if footer exists in layout)
- Consider adding to login/signup pages
- Optional: Add to dashboard or profile pages
- Ensure links are accessible via keyboard navigation

**Metadata:**
- Page title: "Privacy Policy - Composer AI" / "Terms of Use - Composer AI"
- Meta description for SEO
- No robots meta tag needed (should be indexed)

### 5. Maintenance Considerations

**Version Control:**
- Include last updated date constant that's easy to update
- Consider adding version history comments in code
- Document any significant changes to policies

**Future Updates:**
- When legal entity is formed: update "operated by" section
- When pricing changes: update usage limits and pricing sections
- When new third-party services added: update privacy policy
- Annual review recommended for legal compliance

**Monitoring:**
- Track page views via Segment Analytics
- Monitor for user questions about policies (via support email)
- Review against GDPR requirements annually

### 6. Optional Enhancements (Future Considerations)

**Consent Tracking:**
- Track when users accept terms (timestamp in user model)
- Re-acceptance flow when terms materially change
- Audit log of policy acceptances

**Interactive Elements:**
- Table of contents with anchor links for long pages
- Collapse/expand sections for better UX
- Search functionality for finding specific terms

**Accessibility:**
- ARIA labels for sections
- Skip to content links
- Screen reader testing
- High contrast mode support

**Internationalization:**
- English version (primary)
- Consider Polish translation (future)
- Language switcher (if needed)

### 7. Implementation Checklist

- [ ] Create `web/app/privacy-policy/page.tsx`
- [ ] Create `web/app/terms-of-use/page.tsx`
- [ ] Write complete Privacy Policy content with all required sections
- [ ] Write complete Terms of Use content with all required sections
- [ ] Apply Tailwind CSS styling consistent with existing pages
- [ ] Add last updated dates to both pages
- [ ] Test responsive design on mobile and desktop
- [ ] Add navigation links (footer, legal menu, etc.)
- [ ] Add metadata (title, description)
- [ ] Test accessibility (keyboard navigation, screen readers)
- [ ] Review legal content for accuracy and completeness
- [ ] Consider legal review (optional but recommended)
- [ ] Deploy to production
- [ ] Update any onboarding flows to reference policies
- [ ] Monitor analytics and user feedback