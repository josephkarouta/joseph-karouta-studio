import ToolFrame from "@/components/tools/ToolFrame";
import FileConverterWorkbench from "@/components/tools/FileConverterWorkbench";

export const metadata = { title: "File Converter" };

export default function FileConverterPage() {
  return (
    <ToolFrame
      path="/tools/file-converter"
      title="File Converter"
      eyebrow="Fast format conversion"
      description="Convert PDF, JPG, JPEG, PNG, WebP, SVG, HEIC, HEIF, BMP and AVIF files directly in your browser. Your source file is not added to Projects or Assets."
      iconName="convert"
      accent="#0891b2"
      soft="rgba(8,145,178,.12)"
      creditLabel="5 free/day"
    >
      <FileConverterWorkbench />
    </ToolFrame>
  );
}
