import ToolFrame from "@/components/tools/ToolFrame";
import ImageToVideoWorkbench from "@/components/tools/ImageToVideoWorkbench";
export const metadata = { title: "Image to Video" };
export default function ImageToVideoPage() { return <ToolFrame path="/tools/image-to-video" title="Image to Video" eyebrow="AI video generation" description="Animate a still image with controlled subject motion, camera movement and timing. Use preview or high-quality mode with a visible credit cost." iconName="video" accent="#db2777" soft="rgba(219,39,119,.12)" creditLabel="24–48 credits"><ImageToVideoWorkbench/></ToolFrame>; }
