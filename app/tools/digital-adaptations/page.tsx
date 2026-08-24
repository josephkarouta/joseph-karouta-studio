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
      accent="#6f2dff"
      soft="rgba(111,45,255,.12)"
      creditLabel={`${CREDIT_COSTS.digitalAdaptationFamily} credits per aspect family`}
    >
      <DigitalAdaptationsWorkbench />
    </ToolFrame>
  );
}
