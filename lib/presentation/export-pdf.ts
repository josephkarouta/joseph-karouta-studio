"use client";

import type { PresentationDocument } from "@/lib/presentation/types";

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        try {
          await image.decode();
        } catch {
          // The image is already available even when decode is unsupported.
        }
        return;
      }

      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 8000);
      });
    }),
  );
}

export async function exportPresentationPdf({
  document,
  rootId,
  quality = "high",
}: {
  document: PresentationDocument;
  rootId: string;
  quality?: "standard" | "high";
}) {
  const root = window.document.getElementById(rootId);

  if (!root) {
    throw new Error("The presentation renderer could not be found.");
  }

  const slides = Array.from(
    root.querySelectorAll<HTMLElement>("[data-presentation-slide='true']"),
  );

  if (slides.length === 0) {
    throw new Error("No presentation pages are available to export.");
  }

  await ensurePresentationFonts(document);
  await documentFontsReady();
  await waitForImages(root);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const pageWidth = 960;
  const pageHeight = 540;
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: [pageWidth, pageHeight],
    compress: true,
    putOnlyUsedFonts: true,
  });

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];

    const canvas = await html2canvas(slide, {
      backgroundColor: "#F8FAFC",
      scale: quality === "high" ? 1.65 : 1.15,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      width: 1600,
      height: 900,
      windowWidth: 1600,
      windowHeight: 900,
      scrollX: 0,
      scrollY: 0,
    });

    if (index > 0) {
      pdf.addPage([pageWidth, pageHeight], "landscape");
    }

    const data = canvas.toDataURL("image/jpeg", quality === "high" ? 0.95 : 0.88);
    pdf.addImage(data, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

    canvas.width = 1;
    canvas.height = 1;
  }

  pdf.setProperties({
    title: document.title,
    subject: document.studioLabel,
    author: "Heyy Studio",
    creator: "Heyy Studio Universal Presentation Engine",
  });

  pdf.save(`${document.filenameBase}.pdf`);
}


function presentationFontNames(document: PresentationDocument) {
  return Array.from(
    new Set(
      document.slides.flatMap((slide) =>
        slide.kind === "typography"
          ? slide.items.map((item) => item.name.trim()).filter(Boolean)
          : [],
      ),
    ),
  );
}

async function ensurePresentationFonts(document: PresentationDocument) {
  if (!("fonts" in window.document)) return;

  const names = presentationFontNames(document);
  if (names.length === 0) return;

  const missing = names.filter(
    (name) => !window.document.fonts.check(`400 18px "${name.replace(/"/g, "")}"`),
  );

  if (missing.length > 0) {
    const familyQuery = missing
      .map((name) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;500;600;700;800;900`)
      .join("&");
    const id = `heyy-presentation-fonts-${missing.join("-").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

    if (!window.document.getElementById(id)) {
      const link = window.document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
      window.document.head.appendChild(link);

      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        link.addEventListener("load", finish, { once: true });
        link.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 4500);
      });
    }
  }

  await Promise.all(
    names.map(async (name) => {
      try {
        await window.document.fonts.load(`400 48px "${name.replace(/"/g, "")}"`);
        await window.document.fonts.load(`700 48px "${name.replace(/"/g, "")}"`);
      } catch {
        // The renderer will use the configured fallback when a font is unavailable.
      }
    }),
  );
}

async function documentFontsReady() {
  if ("fonts" in window.document) {
    try {
      await window.document.fonts.ready;
    } catch {
      // Export can continue with the available system font.
    }
  }
}
