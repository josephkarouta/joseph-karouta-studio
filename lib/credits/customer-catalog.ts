import { CREDIT_COSTS, getPowerPointCreditCost, POWERPOINT_INCLUDED_SLIDES } from "@/lib/credits/config";

export type CreditGuideItem = {
  id: string;
  category: "AI Tools" | "Utilities" | "Brand Studio" | "Marketing Studio";
  label: string;
  credits: number;
  unit?: string;
  detail: string;
};

export const CUSTOMER_CREDIT_GUIDE: CreditGuideItem[] = [
  {
    id: "pdf-tools",
    category: "Utilities",
    label: "PDF Tools",
    credits: CREDIT_COSTS.pdfUtility,
    unit: "after 5 free daily uses",
    detail: "Free accounts get 5 successful PDF operations each day. Starter and Pro use PDF Tools without credit deductions.",
  },
  {
    id: "file-converter",
    category: "Utilities",
    label: "File Converter",
    credits: CREDIT_COSTS.fileConversion,
    unit: "after 5 free daily conversions",
    detail: "Free accounts get 5 successful conversions each day. Starter and Pro conversions are unlimited subject to fair-use limits.",
  },
  {
    id: "text-to-image",
    category: "AI Tools",
    label: "Image generation",
    credits: CREDIT_COSTS.textToImageHigh,
    detail: "One generated image.",
  },
  {
    id: "image-edit",
    category: "AI Tools",
    label: "Image edit",
    credits: CREDIT_COSTS.imageEdit,
    detail: "One AI image edit or variation.",
  },
  {
    id: "digital-adaptation",
    category: "AI Tools",
    label: "Digital Adaptation",
    credits: CREDIT_COSTS.digitalAdaptationFamily,
    unit: "per AI composition",
    detail: "Compatible export sizes can share one generated composition.",
  },
  {
    id: "upscale-2x",
    category: "AI Tools",
    label: "AI Upscaler · 2×",
    credits: CREDIT_COSTS.aiUpscale2x,
    detail: "Enlarge the source to 2× its width and height using the selected enhancement approach.",
  },
  {
    id: "upscale-4x",
    category: "AI Tools",
    label: "AI Upscaler · 4×",
    credits: CREDIT_COSTS.aiUpscale4x,
    detail: "Enlarge the source to 4× its width and height. Large sources remain subject to output-size safety limits.",
  },
  {
    id: "video",
    category: "AI Tools",
    label: "Image to Video",
    credits: CREDIT_COSTS.imageToVideoHigh,
    detail: "One 1080p, 8-second generated video with audio.",
  },
  {
    id: "powerpoint",
    category: "AI Tools",
    label: `PowerPoint 1–${POWERPOINT_INCLUDED_SLIDES} slides`,
    credits: getPowerPointCreditCost(POWERPOINT_INCLUDED_SLIDES),
    detail: `${CREDIT_COSTS.powerpoint11To15} credits for 11–15 slides and ${CREDIT_COSTS.powerpoint16To20} credits for 16–20 slides.`,
  },
  {
    id: "brand-system",
    category: "Brand Studio",
    label: "Brand System",
    credits: CREDIT_COSTS.brandSystemText,
    detail: "Initial structured brand foundation.",
  },
  {
    id: "brand-directions",
    category: "Brand Studio",
    label: "Creative Directions",
    credits: CREDIT_COSTS.brandDirectionText,
    detail: "Generate the structured creative-direction set.",
  },
  {
    id: "brand-visual",
    category: "Brand Studio",
    label: "Brand visual or logo concept",
    credits: CREDIT_COSTS.brandLogoConcept,
    detail: "One generated visual concept or variation.",
  },
  {
    id: "brand-guidelines",
    category: "Brand Studio",
    label: "Brand Guidelines",
    credits: CREDIT_COSTS.brandGuidelines,
    detail: "Generate or update the guideline system.",
  },
  {
    id: "brand-application",
    category: "Brand Studio",
    label: "Brand application visual",
    credits: CREDIT_COSTS.brandApplicationVisual,
    unit: "per generated format",
    detail: "Most applications create one format. Social systems charge only for the selected formats generated.",
  },
  {
    id: "marketing-guided",
    category: "Marketing Studio",
    label: "Guided campaign strategy",
    credits: CREDIT_COSTS.marketingCampaign,
    detail: "One guided strategy generation.",
  },
  {
    id: "marketing-professional",
    category: "Marketing Studio",
    label: "Professional creative strategy",
    credits: CREDIT_COSTS.marketingCreativePack,
    detail: "One more advanced structured strategy generation.",
  },
  {
    id: "marketing-visual",
    category: "Marketing Studio",
    label: "Campaign visual",
    credits: CREDIT_COSTS.marketingProfessionalFinal,
    detail: "One generated campaign visual or regeneration.",
  },
];

export function getCreditExamples(credits: number) {
  const available = Math.max(0, Math.floor(Number(credits) || 0));
  const imageCost = CREDIT_COSTS.textToImageHigh;
  const videoCost = CREDIT_COSTS.imageToVideoHigh;
  const powerpointCost = getPowerPointCreditCost(POWERPOINT_INCLUDED_SLIDES);

  return [
    { id: "images", label: "images", count: Math.floor(available / imageCost) },
    { id: "videos", label: "1080p videos", count: Math.floor(available / videoCost) },
    { id: "presentations", label: `${POWERPOINT_INCLUDED_SLIDES}-slide presentations`, count: Math.floor(available / powerpointCost) },
  ];
}
