import { jsPDF } from "jspdf";

export type PdfOperation = "compress" | "split" | "merge" | "protect";
export type OutputFile = { name: string; blob: Blob; mimeType: string };

type RenderedPage = {
  pageNumber: number;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};

type PdfSource = {
  file: File;
  password?: string;
};

async function getPdfJs() {
  // @ts-ignore -- pdfjs-dist/webpack.mjs is the official webpack entry but currently ships without a matching declaration file.
  return await import("pdfjs-dist/webpack.mjs");
}

function safeBaseName(name: string) {
  return (name.replace(/\.[^.]+$/, "") || "document")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "document";
}

function downloadName(source: string, suffix: string, extension: string) {
  return `${safeBaseName(source)}-${suffix}.${extension}`;
}

function orientationFor(width: number, height: number): "portrait" | "landscape" {
  return width > height ? "landscape" : "portrait";
}

function canvasBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The converted file could not be created."));
    }, mimeType, quality);
  });
}


function passwordError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /password|encrypted/i.test(message);
}

async function renderPdf(source: PdfSource, options?: { scale?: number; pages?: number[]; maxPages?: number }) {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await source.file.arrayBuffer());
  let pdfDocument: any;
  try {
    pdfDocument = await pdfjs.getDocument({
      data,
      password: source.password || undefined,
      enableXfa: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    if (passwordError(error)) {
      throw new Error("This PDF is password-protected. Remove its password protection before uploading it to Heyy Studio.");
    }
    throw error;
  }

  if (options?.maxPages && pdfDocument.numPages > options.maxPages) {
    pdfDocument.destroy?.();
    throw new Error(`This PDF has ${pdfDocument.numPages} pages. The current limit is ${options.maxPages} pages per operation.`);
  }

  const requestedPages = options?.pages?.length
    ? options.pages
    : Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1);
  const scale = Math.max(0.7, Math.min(2.2, options?.scale || 1.45));
  const rendered: RenderedPage[] = [];

  for (const pageNumber of requestedPages) {
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) continue;
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser could not prepare the PDF page.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    rendered.push({
      pageNumber,
      width: baseViewport.width,
      height: baseViewport.height,
      canvas,
    });
    page.cleanup?.();
  }
  pdfDocument.cleanup?.();
  pdfDocument.destroy?.();
  return rendered;
}

function parsePageSelection(value: string, pageCount: number) {
  const raw = value.trim();
  if (!raw) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set<number>();
  for (const part of raw.split(",").map((item) => item.trim()).filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      const page = Number(part);
      if (page >= 1 && page <= pageCount) pages.add(page);
      continue;
    }
    const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) throw new Error("Use page numbers like 1,3,5-8.");
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount || start > end) {
      throw new Error(`Page range ${part} is outside this PDF.`);
    }
    for (let page = start; page <= end; page += 1) pages.add(page);
  }
  if (!pages.size) throw new Error("Choose at least one page.");
  return Array.from(pages);
}

async function countPdfPages(file: File, password?: string) {
  const pdfjs = await getPdfJs();
  try {
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      password: password || undefined,
      enableXfa: false,
      isEvalSupported: false,
    }).promise;
    const count = document.numPages;
    document.destroy?.();
    return count;
  } catch (error) {
    if (passwordError(error)) {
      throw new Error("This PDF is password-protected. Remove its password protection before uploading it to Heyy Studio.");
    }
    throw error;
  }
}

function createPdfFromPages(
  pages: RenderedPage[],
  options?: {
    jpegQuality?: number;
    encryption?: { userPassword: string; ownerPassword: string; userPermissions?: ("print" | "modify" | "copy" | "annot-forms")[] };
    overlays?: (doc: jsPDF, page: RenderedPage, outputPageNumber: number) => Promise<void> | void;
  },
) {
  if (!pages.length) throw new Error("No PDF pages were available to process.");
  const first = pages[0];
  const doc = new jsPDF({
    orientation: orientationFor(first.width, first.height),
    unit: "pt",
    format: [first.width, first.height],
    compress: true,
    ...(options?.encryption ? { encryption: options.encryption } : {}),
  });
  const quality = Math.max(0.35, Math.min(0.98, options?.jpegQuality ?? 0.9));

  const addPages = async () => {
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      if (index > 0) doc.addPage([page.width, page.height], orientationFor(page.width, page.height));
      const dataUrl = page.canvas.toDataURL("image/jpeg", quality);
      doc.addImage(dataUrl, "JPEG", 0, 0, page.width, page.height, undefined, "FAST");
      if (options?.overlays) await options.overlays(doc, page, index + 1);
    }
    return doc.output("blob");
  };

  return addPages();
}

export async function processPdfOperation(input: {
  operation: PdfOperation;
  files: File[];
  pageSelection?: string;
    newPassword?: string;
  maxPages?: number;
}): Promise<OutputFile[]> {
  const {
    operation,
    files,
    pageSelection = "",
    newPassword = "",
    maxPages = 50,
  } = input;

  if (!files.length) throw new Error("Attach a PDF first.");
  if (files.some((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    throw new Error("PDF Tools only accepts PDF files.");
  }

  if (operation === "merge") {
    if (files.length < 2) throw new Error("Attach at least two PDFs to combine.");
    const pages: RenderedPage[] = [];
    let remainingPages = maxPages;
    for (const file of files) {
      const count = await countPdfPages(file);
      if (count > remainingPages) throw new Error(`Combined PDFs exceed the ${maxPages}-page limit for one operation.`);
      pages.push(...await renderPdf({ file }, { scale: 1.35, maxPages: remainingPages }));
      remainingPages -= count;
    }
    const blob = await createPdfFromPages(pages, { jpegQuality: 0.9 });
    return [{ name: "heyy-studio-combined.pdf", blob, mimeType: "application/pdf" }];
  }

  const source = files[0];
  const pageCount = await countPdfPages(source);
  if (pageCount > maxPages) throw new Error(`This PDF has ${pageCount} pages. The current limit is ${maxPages} pages per operation.`);

  if (operation === "split") {
    const selected = parsePageSelection(pageSelection, pageCount);
    const pages = await renderPdf({ file: source }, { pages: selected, scale: 1.4 });
    const blob = await createPdfFromPages(pages, { jpegQuality: 0.9 });
    return [{ name: downloadName(source.name, "selected-pages", "pdf"), blob, mimeType: "application/pdf" }];
  }

  if (operation === "compress") {
    const pages = await renderPdf({ file: source }, { scale: 1.0 });
    const blob = await createPdfFromPages(pages, { jpegQuality: 0.58 });
    return [{ name: downloadName(source.name, "compressed", "pdf"), blob, mimeType: "application/pdf" }];
  }

  if (operation === "protect") {
    if (newPassword.trim().length < 4) throw new Error("Choose a password with at least 4 characters.");
    const pages = await renderPdf({ file: source }, { scale: 1.4 });
    const ownerPassword = `${newPassword}-${crypto.randomUUID()}`;
    const blob = await createPdfFromPages(pages, {
      jpegQuality: 0.9,
      encryption: {
        userPassword: newPassword,
        ownerPassword,
        userPermissions: ["print", "copy"],
      },
    });
    return [{ name: downloadName(source.name, "protected", "pdf"), blob, mimeType: "application/pdf" }];
  }

  throw new Error("This PDF operation is not available yet.");
}

export type ConverterFormat = "pdf" | "jpg" | "jpeg" | "png" | "webp" | "svg" | "heic" | "heif" | "bmp" | "avif";

export const CONVERTER_TARGETS: Record<ConverterFormat, ConverterFormat[]> = {
  pdf: ["jpg", "jpeg", "png", "webp"],
  jpg: ["jpeg", "png", "webp", "pdf"],
  jpeg: ["jpg", "png", "webp", "pdf"],
  png: ["jpg", "jpeg", "webp", "pdf"],
  webp: ["jpg", "jpeg", "png", "pdf"],
  svg: ["jpg", "jpeg", "png", "webp", "pdf"],
  heic: ["jpg", "jpeg", "png", "webp", "pdf"],
  heif: ["jpg", "jpeg", "png", "webp", "pdf"],
  bmp: ["jpg", "jpeg", "png", "webp", "pdf"],
  avif: ["jpg", "jpeg", "png", "webp", "pdf"],
};

export function formatFromFile(file: File): ConverterFormat | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["pdf", "jpg", "jpeg", "png", "webp", "svg", "heic", "heif", "bmp", "avif"].includes(ext)) {
    return ext as ConverterFormat;
  }
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/jpeg") return ext === "jpeg" ? "jpeg" : "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  if (file.type === "image/bmp") return "bmp";
  if (file.type === "image/avif") return "avif";
  return null;
}

function isHeicFamily(format: ConverterFormat) {
  return format === "heic" || format === "heif";
}

async function decodeHeic(file: File, toType: "image/jpeg" | "image/png" = "image/jpeg") {
  const module = await import("heic2any");
  const heic2any = module.default;
  const converted = await heic2any({ blob: file, toType, quality: 0.94 });
  const blobs = Array.isArray(converted) ? converted : [converted];
  if (!blobs.length) throw new Error("The HEIC/HEIF image could not be decoded.");
  return blobs;
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This image format could not be decoded by your browser."));
      image.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function imageCanvas(image: HTMLImageElement, backgroundWhite = false) {
  const maxDimension = 8192;
  const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the image.");
  if (backgroundWhite) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function imageToPdf(file: File) {
  const image = await loadImage(file);
  const canvas = imageCanvas(image, true);
  const landscape = canvas.width > canvas.height;
  const pageWidth = landscape ? 841.89 : 595.28;
  const pageHeight = landscape ? 595.28 : 841.89;
  const margin = 28;
  const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
  doc.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", x, y, width, height, undefined, "FAST");
  return doc.output("blob");
}

function targetMimeType(to: ConverterFormat) {
  if (to === "png") return "image/png";
  if (to === "webp") return "image/webp";
  return "image/jpeg";
}

function targetExtension(to: ConverterFormat) {
  return to === "jpeg" ? "jpeg" : to;
}

async function convertHeicFile(file: File, to: ConverterFormat): Promise<OutputFile[]> {
  const directType: "image/jpeg" | "image/png" = to === "png" ? "image/png" : "image/jpeg";
  const decoded = await decodeHeic(file, directType);
  const base = safeBaseName(file.name);

  if (to === "jpg" || to === "jpeg" || to === "png") {
    return decoded.map((blob, index) => ({
      name: `${base}${decoded.length > 1 ? `-${index + 1}` : ""}.${targetExtension(to)}`,
      blob,
      mimeType: directType,
    }));
  }

  const first = decoded[0];
  const intermediate = new File([first], `${base}.${directType === "image/png" ? "png" : "jpg"}`, { type: directType });
  if (to === "pdf") {
    return [{ name: `${base}.pdf`, blob: await imageToPdf(intermediate), mimeType: "application/pdf" }];
  }

  const image = await loadImage(intermediate);
  const canvas = imageCanvas(image, false);
  const mimeType = targetMimeType(to);
  const blob = await canvasBlob(canvas, mimeType, 0.92);
  return [{ name: `${base}.${targetExtension(to)}`, blob, mimeType }];
}

export async function convertFile(file: File, from: ConverterFormat, to: ConverterFormat, maxPdfPages = 50): Promise<OutputFile[]> {
  if (from === to) throw new Error("Choose a different output format.");
  if (!CONVERTER_TARGETS[from]?.includes(to)) throw new Error(`Converting ${from.toUpperCase()} to ${to.toUpperCase()} is not supported.`);
  const actual = formatFromFile(file);
  if (actual !== from) throw new Error(`The attached file is ${actual ? actual.toUpperCase() : "an unsupported format"}, not ${from.toUpperCase()}.`);

  if (from === "pdf") {
    const pages = await renderPdf({ file }, { scale: 1.8, maxPages: maxPdfPages });
    const mimeType = targetMimeType(to);
    const quality = to === "png" ? undefined : 0.92;
    const outputs: OutputFile[] = [];
    for (const page of pages) {
      outputs.push({
        name: `${safeBaseName(file.name)}-page-${page.pageNumber}.${targetExtension(to)}`,
        blob: await canvasBlob(page.canvas, mimeType, quality),
        mimeType,
      });
    }
    return outputs;
  }

  if (isHeicFamily(from)) {
    return await convertHeicFile(file, to);
  }

  if (to === "pdf") {
    return [{ name: `${safeBaseName(file.name)}.pdf`, blob: await imageToPdf(file), mimeType: "application/pdf" }];
  }

  const image = await loadImage(file);
  const mimeType = targetMimeType(to);
  const canvas = imageCanvas(image, to === "jpg" || to === "jpeg");
  const blob = await canvasBlob(canvas, mimeType, to === "png" ? undefined : 0.92);
  return [{ name: `${safeBaseName(file.name)}.${targetExtension(to)}`, blob, mimeType }];
}

export function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
