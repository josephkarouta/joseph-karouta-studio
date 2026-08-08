"use client";

import { BRAND_BOOK_CREDIT_COSTS } from "@/lib/credits/brand-book-credit-costs";

const mockups = [
  {
    title: "Website Hero Render",
    body: "Premium AI-rendered homepage hero mockup.",
    cost: BRAND_BOOK_CREDIT_COSTS.premiumWebsiteMockup,
  },
  {
    title: "Packaging Render",
    body: "Photorealistic product or packaging mockup.",
    cost: BRAND_BOOK_CREDIT_COSTS.premiumPackagingMockup,
  },
  {
    title: "Billboard Render",
    body: "Outdoor campaign billboard visualization.",
    cost: BRAND_BOOK_CREDIT_COSTS.premiumBillboardMockup,
  },
  {
    title: "Vehicle Branding Render",
    body: "Premium vehicle branding visualization.",
    cost: BRAND_BOOK_CREDIT_COSTS.premiumVehicleMockup,
  },
  {
    title: "Full Premium Mockup Pack",
    body: "Website, packaging, billboard, vehicle and campaign renders.",
    cost: BRAND_BOOK_CREDIT_COSTS.fullPremiumMockupPack,
  },
];

export default function PremiumMockupExportPanel() {
  return (
    <section className="rounded-[2rem] border border-purple-400/20 bg-purple-500/10 p-8">
      <p className="text-xs uppercase tracking-[0.35em] text-purple-200">
        Premium AI Mockups
      </p>

      <h2 className="mt-4 text-3xl font-black">
        Credit-based visual renders
      </h2>

      <p className="mt-4 max-w-2xl leading-7 text-white/60">
        These premium mockups are not generated automatically with every Brand
        Book. Users can generate them only when needed, keeping your AI costs
        controlled.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {mockups.map((item) => (
          <div
            key={item.title}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  {item.body}
                </p>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black">
                {item.cost} credits
              </span>
            </div>

            <button
              type="button"
              className="mt-5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/65 transition hover:bg-white hover:text-black"
            >
              Generate Later
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
