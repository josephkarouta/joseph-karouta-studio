import ToolFrame from "@/components/tools/ToolFrame";
import UpscalerWorkbench from "@/components/tools/UpscalerWorkbench";
import { CREDIT_COSTS } from "@/lib/credits/config";

export const metadata = { title: "Image Upscaler" };

export default function UpscalerPage() {
  return (
    <ToolFrame
      path="/tools/ai-upscaler"
      title="Image Upscaler"
      eyebrow="Professional image enhancement"
      description="Increase resolution, recover detail and choose an enhancement approach suited to photography, illustration or graphics."
      iconName="images"
      accent="#0284c7"
      soft="rgba(2,132,199,.12)"
      imageSrc="/tool-heroes/ai-upscaler-hero.webp"
      imagePosition="center 54%"
      creditLabel={`${CREDIT_COSTS.aiUpscale2x}–${CREDIT_COSTS.aiUpscale4x} credits`}
    >
      <UpscalerWorkbench />
    </ToolFrame>
  );
}
