import ToolFrame from "@/components/tools/ToolFrame";
import PowerPointWorkbench from "@/components/tools/PowerPointWorkbench";
import { CREDIT_COSTS, POWERPOINT_INCLUDED_SLIDES } from "@/lib/credits/config";
export const metadata={title:"PowerPoint Generator"};
export default function PowerPointPage(){return <ToolFrame path="/tools/powerpoint-generator" title="PowerPoint Generator" eyebrow="Research + native PPTX" description="Turn source material or a research brief into a professionally structured, visually directed and editable PowerPoint deck." iconName="presentation" accent="#ea580c" soft="rgba(234,88,12,.12)" creditLabel={`${CREDIT_COSTS.powerpointFull} credits up to ${POWERPOINT_INCLUDED_SLIDES} slides`}><PowerPointWorkbench/></ToolFrame>;}
