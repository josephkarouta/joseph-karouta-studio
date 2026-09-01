import ToolFrame from "@/components/tools/ToolFrame";
import ImageToVideoWorkbench from "@/components/tools/ImageToVideoWorkbench";
import { CREDIT_COSTS } from "@/lib/credits/config";

export const metadata = { title: "Image to Video" };

export default function ImageToVideoPage() {
  return (
    <ToolFrame
      path="/tools/image-to-video"
      title="Image to Video"
      eyebrow="AI video generation"
      description="Animate a still image into an 8-second video with controlled subject motion, camera movement and timing."
      iconName="video"
      accent="#db2777"
      soft="rgba(219,39,119,.12)"
      creditLabel={`From ${CREDIT_COSTS.imageToVideoFast720} credits`}
    >
      <ImageToVideoWorkbench />
    </ToolFrame>
  );
}
