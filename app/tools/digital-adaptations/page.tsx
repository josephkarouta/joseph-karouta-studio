import ToolFrame from "@/components/tools/ToolFrame";
import DigitalAdaptationsWorkbench from "@/components/tools/DigitalAdaptationsWorkbench";
import { CREDIT_COSTS } from "@/lib/credits/config";

export const metadata = { title: "Digital Adaptations" };

export default function DigitalAdaptationsPage() {
  return (
    <ToolFrame
      path="/tools/digital-adaptations"
      title="Digital Adaptations"
      eyebrow="Key visual size adaptation"
      description="Turn one approved campaign key visual into a coordinated digital size pack for social, web and display while protecting the original brand system."
      iconName="adaptation"
      accent="#8b5cf6"
      soft="rgba(139,92,246,.12)"
      imageSrc="/tool-heroes/digital-adaptations-hero.webp"
      imagePosition="center 54%"
      creditLabel={`${CREDIT_COSTS.digitalAdaptationFamily} credits per aspect-ratio composition`}
    >
      <DigitalAdaptationsWorkbench />
    </ToolFrame>
  );
}
