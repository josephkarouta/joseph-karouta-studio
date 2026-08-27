import ToolFrame from "@/components/tools/ToolFrame";
import TextToImageWorkbench from "@/components/tools/TextToImageWorkbench";
import { CREDIT_COSTS } from "@/lib/credits/config";

export const metadata = { title: "Text to Image" };
export default function TextToImagePage() { return <ToolFrame path="/tools/text-to-image" title="Text to Image" eyebrow="AI image generation" description="Create a high-quality visual from a clear prompt, save it as a project asset and see the credit cost before generation." iconName="image" accent="#7c3aed" soft="rgba(124,58,237,.12)" creditLabel={`${CREDIT_COSTS.textToImageHigh} credits`}><TextToImageWorkbench/></ToolFrame>; }
