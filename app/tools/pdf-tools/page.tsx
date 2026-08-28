import ToolFrame from "@/components/tools/ToolFrame";
import PdfToolsWorkbench from "@/components/tools/PdfToolsWorkbench";

export const metadata = { title: "PDF Tools" };

export default function PdfToolsPage() {
  return (
    <ToolFrame
      path="/tools/pdf-tools"
      title="PDF Tools"
      eyebrow="Everyday document utilities"
      description="Compress, split, combine, unlock and protect PDFs without saving the source file to your Heyy Studio workspace."
      iconName="pdf"
      accent="#0f766e"
      soft="rgba(15,118,110,.12)"
      creditLabel="5/day free · Plans unlimited"
    >
      <PdfToolsWorkbench />
    </ToolFrame>
  );
}
