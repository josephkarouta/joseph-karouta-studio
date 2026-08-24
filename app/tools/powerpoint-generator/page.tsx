import ToolFrame from "@/components/tools/ToolFrame";
import PowerPointWorkbench from "@/components/tools/PowerPointWorkbench";
import { CREDIT_COSTS } from "@/lib/credits/config";
export const metadata={title:"PowerPoint Generator"};
export default function PowerPointPage(){return <ToolFrame path="/tools/powerpoint-generator" title="PowerPoint Generator" eyebrow="Structured AI + native PPTX" description="Turn a brief or source document into a clear slide story and download a native, editable PowerPoint file." iconName="presentation" accent="#ea580c" soft="rgba(234,88,12,.12)" creditLabel={`${CREDIT_COSTS.powerpointDraft}–${CREDIT_COSTS.powerpointFull} credits`}><PowerPointWorkbench/></ToolFrame>;}
