import type { PublicSection } from "@/components/public/PublicPage";

export const legalPages: Record<string, { eyebrow: string; title: string; summary: string; updated: string; sections: PublicSection[] }> = {
  terms: {
    eyebrow: "Legal",
    title: "Terms and Conditions",
    summary: "These terms explain how Heyy Studio accounts, AI tools, credits, subscriptions and separately quoted expert production work.",
    updated: "July 27, 2026",
    sections: [
      { title: "Using Heyy Studio", paragraphs: ["You must provide accurate account information, protect your sign-in credentials and use the platform lawfully. You remain responsible for the briefs, prompts, files and instructions you submit."], bullets: ["Do not upload content you do not have the right to use.", "Do not attempt to bypass plan, credit, security or rate limits.", "Do not use generated output as professional technical documentation without appropriate review."] },
      { title: "AI concepts and professional review", paragraphs: ["AI outputs are working concepts and creative assistance. They may contain errors, omissions or unsuitable recommendations. Architecture and interior outputs are not permits, engineering, construction, safety or installation documentation. Brand concepts are not automatically trademark cleared or production ready."] },
      { title: "Subscriptions and credits", paragraphs: ["Subscription plans provide access and recurring credit allowances according to the plan shown at checkout. Credits are a platform usage unit, not cash, and are consumed by eligible generation actions. Failed provider generations should automatically release reserved credits."], bullets: ["Unused subscription credits expire at the end of each paid billing period and are replaced by the renewed plan allowance.", "Purchased credit-pack credits do not expire and remain separate from subscription credits.", "Custom expert production is not included unless explicitly stated in a quote."] },
      { title: "Expert production", paragraphs: ["A production request is an inquiry, not authorization to begin work. Heyy Studio may review the scope and provide a separate quote with price, timeline, included revisions and deliverables. Production normally begins only after payment confirmation."] },
      { title: "Intellectual property", paragraphs: ["You retain rights in your original materials. Rights in final expert deliverables are governed by the accepted quote and any specific licensing terms. AI-generated content may not be unique and may require legal, trademark, licensing or production review before commercial use."] },
      { title: "Availability and liability", paragraphs: ["The platform may change, pause or discontinue features and providers. To the extent permitted by law, Heyy Studio is not liable for indirect loss, lost profits, third-party provider failures or decisions made from unreviewed AI output."] },
    ],
  },
  privacy: {
    eyebrow: "Trust",
    title: "Privacy Policy",
    summary: "This policy explains the information Heyy Studio processes to provide accounts, projects, generation, payment and production workflows.",
    updated: "July 27, 2026",
    sections: [
      { title: "Information we collect", bullets: ["Account information such as name, email and authentication identifiers.", "Project briefs, prompts, uploads, generated outputs, assets and workspace activity.", "Subscription, quote and payment metadata provided by payment processors.", "Support, contact, career and production communications.", "Technical information needed for security, diagnostics and service operation."] },
      { title: "How information is used", paragraphs: ["We use information to operate the workspace, generate outputs, save project context, enforce credits, process payments, manage production, provide support and improve reliability. We do not sell personal data to advertisers."] },
      { title: "Service providers", paragraphs: ["Heyy Studio relies on providers for authentication and database services, payments, AI generation, email, hosting, storage and enhancement. Information is shared only as needed to perform the requested service and remains subject to provider terms and safeguards."] },
      { title: "Project privacy and retention", paragraphs: ["Project data is intended to be scoped to the account and project. Retention depends on the account, legal obligations and operational needs. You may request access, correction or deletion, subject to records that must be kept for payment, legal or fraud-prevention reasons."] },
      { title: "Your choices", bullets: ["Manage account and billing details from your workspace.", "Avoid placing unnecessary sensitive personal information in prompts or uploads.", "Contact Heyy Studio to request privacy access, correction or deletion."] },
    ],
  },
  refunds: {
    eyebrow: "Billing",
    title: "Refund Policy",
    summary: "Subscription, credit and custom production payments are different products and are reviewed under different conditions.",
    updated: "July 27, 2026",
    sections: [
      { title: "AI generation credits", paragraphs: ["When a provider generation fails before a usable result is returned, reserved credits should be released automatically. Dissatisfaction with a successfully completed creative result does not automatically create a refund because generation is variable and iterative." ] },
      { title: "Subscriptions", paragraphs: ["You may cancel future renewal through the available billing controls. Except where required by law, charges already processed are generally non-refundable after the billing period begins and credits are made available."] },
      { title: "Credit top-ups", paragraphs: ["Purchased credit packs are generally non-refundable after use. Unused top-ups may be reviewed case by case where required by law or where a duplicate or incorrect charge occurred."] },
      { title: "Expert production", paragraphs: ["Refund and cancellation terms for custom production are defined in the accepted quote. Work already completed, committed supplier costs and non-recoverable expenses may be deducted from any approved refund."] },
      { title: "Requesting a review", paragraphs: ["Contact support with the account email, payment reference, date and reason. Heyy Studio may request additional information before deciding the request."] },
    ],
  },
  "responsible-ai": {
    eyebrow: "Trust",
    title: "Responsible AI",
    summary: "Heyy Studio uses AI to accelerate structured creative work while keeping limits, professional review and user responsibility visible.",
    updated: "July 27, 2026",
    sections: [
      { title: "AI is a starting point", paragraphs: ["Generated strategies, visuals, plans and recommendations may be incomplete or incorrect. The platform labels concept output and provides an expert-production route when professional finalization is needed."] },
      { title: "High-risk boundaries", bullets: ["Architecture output is not permit, engineering or construction documentation.", "Interior output is not electrical, structural, fire, accessibility or installation advice.", "Brand and marketing output is not automatic trademark, legal, claims or platform-policy approval.", "Users should verify important facts, rights, specifications and decisions."] },
      { title: "Content and rights", paragraphs: ["Users should not request unlawful, harmful, deceptive or rights-infringing content. Uploads and prompts should avoid unnecessary personal or confidential information. Generated output should be reviewed before publication or production."] },
      { title: "Human accountability", paragraphs: ["AI can create options and structure. Qualified people remain responsible for final technical, legal, safety, production and commercial decisions."] },
    ],
  },
  security: {
    eyebrow: "Trust",
    title: "Security",
    summary: "Heyy Studio separates client, server and payment responsibilities so sensitive credentials and operational records remain controlled.",
    updated: "July 27, 2026",
    sections: [
      { title: "Platform safeguards", bullets: ["Service-role database credentials and provider secret keys remain server-side.", "User-owned project records use authentication and row-level access policies.", "Stripe webhook signatures are verified before payment state changes.", "Payment events are processed idempotently to reduce duplicate jobs.", "Generated and delivered assets are organized by user and project paths."] },
      { title: "Account responsibility", paragraphs: ["Use a strong password, protect your email account and sign out from shared devices. Contact support promptly if you suspect unauthorized access."] },
      { title: "Reporting a security issue", paragraphs: ["Send a responsible disclosure through the contact page with enough information to reproduce the issue. Do not access, alter or retain data that does not belong to you."] },
    ],
  },
  "content-policy": {
    eyebrow: "Trust",
    title: "Content Policy",
    summary: "These rules protect users, rights holders, providers and the integrity of the creative platform.",
    updated: "July 27, 2026",
    sections: [
      { title: "Not permitted", bullets: ["Illegal, exploitative, abusive or deliberately harmful content.", "Content that meaningfully facilitates fraud, impersonation, malware or unauthorized surveillance.", "Uploads or requests that violate copyright, trademark, privacy or contractual rights.", "Attempts to generate deceptive professional documentation or false approvals.", "Content intended to evade provider safeguards or platform limits."] },
      { title: "Commercial review", paragraphs: ["Before using generated work commercially, review licenses, claims, likeness, trademarks, product representations and local requirements. Heyy Studio may remove content, restrict access or decline production where risk cannot be responsibly managed."] },
    ],
  },
};
