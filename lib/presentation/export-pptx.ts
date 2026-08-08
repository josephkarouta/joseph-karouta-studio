"use client";

import type {
  PresentationCard,
  PresentationDocument,
  PresentationImage,
  PresentationMaterialItem,
  PresentationPaletteItem,
  PresentationSlide,
  PresentationTone,
} from "@/lib/presentation/types";
import { HEYY_LOGO_EXPORT_ASSETS } from "@/lib/brand/heyy-logo-assets";

const W = 13.333;
const H = 7.5;

const toneColours: Record<PresentationTone, { soft: string; strong: string; ink: string }> = {
  purple: { soft: "F2E9FF", strong: "6C00FF", ink: "3E007F" },
  blue: { soft: "EAF4FF", strong: "1769D2", ink: "0E447F" },
  green: { soft: "E8F8EF", strong: "0B8F4D", ink: "075E34" },
  amber: { soft: "FFF4D8", strong: "B46A00", ink: "744300" },
  neutral: { soft: "EFF2F6", strong: "334155", ink: "172033" },
};

type ResolvedImage = {
  data: string;
  width: number;
  height: number;
};

function hex(value: string | undefined, fallback = "6C00FF") {
  return (value || fallback).replace("#", "").toUpperCase();
}

function textOptions(extra: Record<string, any> = {}) {
  return {
    fontFace: "Aptos",
    color: "18202B",
    margin: 0,
    breakLine: false,
    valign: "mid",
    ...extra,
  };
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlDimensions(data: string) {
  return await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: Math.max(1, image.naturalWidth || image.width),
        height: Math.max(1, image.naturalHeight || image.height),
      });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = data;
  });
}

async function resolveImage(
  image: PresentationImage | null | undefined,
  cache: Map<string, Promise<ResolvedImage | null>>,
) {
  if (!image?.url) return null;

  if (!cache.has(image.url)) {
    cache.set(
      image.url,
      (async () => {
        try {
          const response = await fetch(image.url, { mode: "cors", credentials: "omit" });
          if (!response.ok) throw new Error(`Image request failed with ${response.status}.`);
          const data = await blobToDataUrl(await response.blob());
          const dimensions = await dataUrlDimensions(data);
          return { data, ...dimensions };
        } catch {
          return null;
        }
      })(),
    );
  }

  return await cache.get(image.url)!;
}

async function addImageBox({
  slide,
  pptx,
  image,
  x,
  y,
  w,
  h,
  cache,
  accent,
}: {
  slide: any;
  pptx: any;
  image?: PresentationImage | null;
  x: number;
  y: number;
  w: number;
  h: number;
  cache: Map<string, Promise<ResolvedImage | null>>;
  accent: string;
}) {
  const ShapeType = pptx.ShapeType;
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: "EEF2F7" },
    line: { color: "D8E1EB", width: 1 },
  });

  const resolved = await resolveImage(image, cache);

  if (!resolved) {
    slide.addText("HEYY STUDIO", textOptions({
      x: x + 0.25,
      y: y + h / 2 - 0.35,
      w: w - 0.5,
      h: 0.25,
      align: "center",
      color: accent,
      fontSize: 10,
      bold: true,
      charSpacing: 2,
    }));
    slide.addText(image?.label || "Visual pending", textOptions({
      x: x + 0.25,
      y: y + h / 2 - 0.02,
      w: w - 0.5,
      h: 0.42,
      align: "center",
      color: "334155",
      fontSize: 18,
      bold: true,
    }));
    return;
  }

  const sourceRatio = resolved.width / resolved.height;
  const boxRatio = w / h;
  const cover = image?.fit !== "contain";
  const renderedWidth = cover
    ? sourceRatio > boxRatio
      ? h * sourceRatio
      : w
    : sourceRatio > boxRatio
      ? w
      : h * sourceRatio;
  const renderedHeight = cover
    ? sourceRatio > boxRatio
      ? h
      : w / sourceRatio
    : sourceRatio > boxRatio
      ? w / sourceRatio
      : h;
  const imageX = x + (w - renderedWidth) / 2;
  const imageY = y + (h - renderedHeight) / 2;

  slide.addImage({
    data: resolved.data,
    x: imageX,
    y: imageY,
    w: renderedWidth,
    h: renderedHeight,
    transparency: 0,
  });
}

async function addBrand({
  slide,
  cache,
  accent,
  light = false,
  x = 0.62,
  y = 0.28,
  wordmarkW = 0.72,
  wordmarkH = 0.45,
}: {
  slide: any;
  cache: Map<string, Promise<ResolvedImage | null>>;
  accent: string;
  light?: boolean;
  x?: number;
  y?: number;
  wordmarkW?: number;
  wordmarkH?: number;
}) {
  const logo = await resolveImage(
    {
      url: light
        ? HEYY_LOGO_EXPORT_ASSETS.light
        : HEYY_LOGO_EXPORT_ASSETS.dark,
      label: "Heyy",
      fit: "contain",
    },
    cache,
  );

  if (logo) {
    slide.addImage({
      data: logo.data,
      x,
      y,
      w: wordmarkW,
      h: wordmarkH,
      sizing: "contain",
    });
  } else {
    slide.addText("HEYY", textOptions({
      x,
      y: y + 0.04,
      w: wordmarkW,
      h: wordmarkH - 0.08,
      fontSize: 13,
      bold: true,
      color: light ? "FFFFFF" : "172033",
    }));
  }

  slide.addText("STUDIO", textOptions({
    x: x + wordmarkW + 0.06,
    y: y + wordmarkH * 0.38,
    w: 0.72,
    h: 0.15,
    fontSize: 6.3,
    bold: true,
    charSpacing: 2.2,
    color: accent,
  }));
}

async function addHeader({
  slide,
  pptx,
  slideModel,
  accent,
  cache,
}: {
  slide: any;
  pptx: any;
  slideModel: Exclude<PresentationSlide, { kind: "cover" }>;
  accent: string;
  cache: Map<string, Promise<ResolvedImage | null>>;
}) {
  await addBrand({ slide, cache, accent, x: 11.28, y: 0.27, wordmarkW: 0.66, wordmarkH: 0.41 });
  slide.addText(slideModel.number || "", textOptions({
    x: 0.62,
    y: 0.73,
    w: 0.55,
    h: 0.45,
    color: accent,
    fontSize: 27,
    bold: true,
    valign: "top",
  }));
  slide.addText(slideModel.eyebrow.toUpperCase(), textOptions({
    x: 1.26,
    y: 0.76,
    w: 8.6,
    h: 0.16,
    color: accent,
    fontSize: 7.8,
    bold: true,
    charSpacing: 2,
    valign: "top",
  }));
  slide.addText(slideModel.title, textOptions({
    x: 1.26,
    y: 0.91,
    w: 10.8,
    h: 0.49,
    color: "18202B",
    fontSize: 25,
    bold: true,
    fit: "shrink",
    valign: "top",
  }));
  slide.addShape(pptx.ShapeType.line, {
    x: 0.62,
    y: 1.49,
    w: 12.08,
    h: 0,
    line: { color: "DFE6EE", width: 1.2 },
  });
}

function addFooter(slide: any, pptx: any, footer: string | undefined, page: number) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.62,
    y: 7.12,
    w: 12.08,
    h: 0,
    line: { color: "DFE6EE", width: 0.8 },
  });
  slide.addText(footer || "Heyy Studio Presentation", textOptions({
    x: 0.62,
    y: 7.18,
    w: 10.8,
    h: 0.14,
    fontSize: 6.8,
    color: "718096",
    bold: true,
  }));
  slide.addText(String(page).padStart(2, "0"), textOptions({
    x: 11.9,
    y: 7.18,
    w: 0.8,
    h: 0.14,
    fontSize: 6.8,
    color: "718096",
    bold: true,
    align: "right",
  }));
}

function addCard({
  slide,
  pptx,
  card,
  x,
  y,
  w,
  h,
}: {
  slide: any;
  pptx: any;
  card: PresentationCard;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const tone = toneColours[card.tone || "neutral"];
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: tone.soft },
    line: { color: tone.strong, width: 1 },
  });
  slide.addText(card.title, textOptions({
    x: x + 0.18,
    y: y + 0.14,
    w: w - 0.36,
    h: 0.24,
    fontSize: 11,
    bold: true,
    color: tone.strong,
  }));
  const bodyLength = card.body.length;
  slide.addText(card.body, textOptions({
    x: x + 0.18,
    y: y + 0.44,
    w: w - 0.36,
    h: h - 0.56,
    fontSize: bodyLength > 520 ? 6.9 : bodyLength > 330 ? 7.8 : 8.8,
    color: tone.ink,
    valign: "top",
    fit: "shrink",
    breakLine: true,
  }));
}

async function renderSlide({
  pptx,
  slideModel,
  page,
  accent,
  cache,
}: {
  pptx: any;
  slideModel: PresentationSlide;
  page: number;
  accent: string;
  cache: Map<string, Promise<ResolvedImage | null>>;
}) {
  const slide = pptx.addSlide();
  slide.background = { color: "F8FAFC" };

  if (slideModel.kind === "cover") {
    slide.background = { color: "11131A" };
    await addImageBox({
      slide,
      pptx,
      image: slideModel.image,
      x: 0,
      y: 0,
      w: W,
      h: H,
      cache,
      accent,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: "11131A", transparency: 28 },
      line: { color: "11131A", transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 7.55,
      h: H,
      fill: { color: "11131A", transparency: 4 },
      line: { color: "11131A", transparency: 100 },
    });
    await addBrand({ slide, cache, accent, light: true, x: 0.62, y: 0.28, wordmarkW: 0.72, wordmarkH: 0.45 });
    slide.addText(slideModel.eyebrow.toUpperCase(), textOptions({
      x: 0.64,
      y: 4.48,
      w: 7.4,
      h: 0.2,
      color: accent,
      fontSize: 8.5,
      bold: true,
      charSpacing: 2.2,
    }));
    slide.addText(slideModel.title, textOptions({
      x: 0.62,
      y: 4.82,
      w: 8.45,
      h: 1.12,
      color: "FFFFFF",
      fontSize: 45,
      bold: true,
      fit: "shrink",
      valign: "bottom",
    }));
    if (slideModel.subtitle) {
      slide.addText(slideModel.subtitle, textOptions({
        x: 0.64,
        y: 6.0,
        w: 7.9,
        h: 0.43,
        color: "D7C8FF",
        fontSize: 21,
        bold: true,
        fit: "shrink",
      }));
    }
    if (slideModel.meta) {
      slide.addText(slideModel.meta, textOptions({
        x: 0.64,
        y: 6.5,
        w: 7.9,
        h: 0.22,
        color: "C8CED8",
        fontSize: 10.5,
      }));
    }
    if (slideModel.logo) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 10.45,
        y: 5.77,
        w: 2.15,
        h: 1.12,
        rectRadius: 0.06,
        fill: { color: "FFFFFF", transparency: 2 },
        line: { color: "FFFFFF", transparency: 65 },
      });
      await addImageBox({
        slide,
        pptx,
        image: slideModel.logo,
        x: 10.68,
        y: 5.98,
        w: 1.68,
        h: 0.7,
        cache,
        accent,
      });
    }
    slide.addText(String(page).padStart(2, "0"), textOptions({
      x: 11.85,
      y: 0.35,
      w: 0.8,
      h: 0.18,
      color: "C8CED8",
      fontSize: 8,
      bold: true,
      align: "right",
    }));
    return;
  }

  await addHeader({ slide, pptx, slideModel, accent, cache });
  addFooter(slide, pptx, slideModel.footer, page);

  if (slideModel.kind === "content") {
    if (slideModel.lead) {
      const leadLength = slideModel.lead.length;
      slide.addText(slideModel.lead, textOptions({
        x: 0.65,
        y: 1.73,
        w: 12.0,
        h: leadLength > 700 ? 0.98 : leadLength > 450 ? 0.86 : 0.72,
        fontSize: leadLength > 700 ? 9.1 : leadLength > 450 ? 10.4 : 12.0,
        color: "4C5B6D",
        fit: "shrink",
        valign: "top",
        breakLine: true,
      }));
    }
    const metrics = slideModel.metrics || [];
    const metricY = slideModel.lead ? 2.78 : 1.82;
    const metricGap = 0.14;
    const metricWidth = (12.05 - metricGap * 3) / 4;
    metrics.slice(0, 8).forEach((metric, index) => {
      const row = Math.floor(index / 4);
      const column = index % 4;
      const x = 0.64 + column * (metricWidth + metricGap);
      const y = metricY + row * 0.88;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: metricWidth,
        h: 0.72,
        rectRadius: 0.04,
        fill: { color: "FFFFFF" },
        line: { color: "D8E1EB", width: 0.8 },
      });
      slide.addText(metric.label.toUpperCase(), textOptions({
        x: x + 0.15,
        y: y + 0.1,
        w: metricWidth - 0.3,
        h: 0.15,
        fontSize: 6.5,
        color: "718096",
        bold: true,
        charSpacing: 1.2,
      }));
      slide.addText(metric.value, textOptions({
        x: x + 0.15,
        y: y + 0.33,
        w: metricWidth - 0.3,
        h: 0.25,
        fontSize: 11.2,
        color: "18202B",
        bold: true,
        fit: "shrink",
      }));
    });
    const cards = slideModel.cards || [];
    const cardY = metricY + (metrics.length > 4 ? 1.88 : metrics.length > 0 ? 1.0 : 0);
    if (cards.length > 0) {
      const gap = 0.16;
      const width = (12.05 - gap * (Math.min(cards.length, 3) - 1)) / Math.min(cards.length, 3);
      cards.slice(0, 3).forEach((card, index) => {
        addCard({
          slide,
          pptx,
          card,
          x: 0.64 + index * (width + gap),
          y: cardY,
          w: width,
          h: 1.92,
        });
      });
    }
    return;
  }

  if (slideModel.kind === "palette") {
    const items = slideModel.items.slice(0, 8);
    const columns = 4;
    const cardW = 2.87;
    const cardH = 2.35;
    items.forEach((item: PresentationPaletteItem, index: number) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = 0.64 + column * 3.04;
      const y = 1.84 + row * 2.55;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: cardW,
        h: cardH,
        rectRadius: 0.05,
        fill: { color: "FFFFFF" },
        line: { color: "D8E1EB", width: 0.8 },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: cardW,
        h: 1.25,
        fill: { color: hex(item.hex, "17151F") },
        line: { color: hex(item.hex, "17151F"), transparency: 100 },
      });
      slide.addText(item.name, textOptions({
        x: x + 0.16,
        y: y + 1.41,
        w: cardW - 0.32,
        h: 0.23,
        fontSize: 11,
        bold: true,
      }));
      slide.addText(`HEX ${item.hex}\nRGB ${item.rgb || "—"}\nCMYK ${item.cmyk || "—"}`, textOptions({
        x: x + 0.16,
        y: y + 1.7,
        w: cardW - 0.32,
        h: 0.5,
        fontSize: 7.3,
        color: "657487",
        valign: "top",
        breakLine: true,
      }));
    });
    return;
  }

  if (slideModel.kind === "typography") {
    const items = slideModel.items.slice(0, 4);
    items.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const x = 0.64 + column * 6.15;
      const y = 1.85 + row * 2.45;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 5.92,
        h: 2.18,
        rectRadius: 0.05,
        fill: { color: "FFFFFF" },
        line: { color: "D8E1EB", width: 0.8 },
      });
      const isHeadingFont = /(heading|headline|title|display)/i.test(item.role || "");
      slide.addText(item.sample || "Aa Bb Cc 0123", textOptions({
        x: x + 0.22,
        y: y + 0.18,
        w: 5.5,
        h: 0.6,
        fontFace: item.name || "Aptos",
        fontSize: 31,
        bold: isHeadingFont,
        fit: "shrink",
      }));
      slide.addText(item.name, textOptions({
        x: x + 0.22,
        y: y + 0.9,
        w: 5.5,
        h: 0.28,
        fontSize: 15,
        bold: true,
      }));
      slide.addText((item.role || "Typography").toUpperCase(), textOptions({
        x: x + 0.22,
        y: y + 1.25,
        w: 5.5,
        h: 0.16,
        fontSize: 7,
        bold: true,
        charSpacing: 1.4,
        color: accent,
      }));
      if (item.reason) {
        slide.addText(item.reason, textOptions({
          x: x + 0.22,
          y: y + 1.53,
          w: 5.45,
          h: 0.42,
          fontSize: 7.5,
          color: "607083",
          fit: "shrink",
          valign: "top",
          breakLine: true,
        }));
      }
    });
    return;
  }

  if (slideModel.kind === "imageText") {
    await addImageBox({
      slide,
      pptx,
      image: slideModel.image,
      x: 0.64,
      y: 1.82,
      w: 7.15,
      h: 5.05,
      cache,
      accent,
    });
    if (slideModel.lead) {
      slide.addText(slideModel.lead, textOptions({
        x: 8.05,
        y: 1.82,
        w: 4.65,
        h: slideModel.lead.length > 520 ? 1.38 : 1.16,
        fontSize: slideModel.lead.length > 520 ? 8.1 : slideModel.lead.length > 320 ? 9.1 : 10.2,
        color: "4C5B6D",
        fit: "shrink",
        valign: "top",
        breakLine: true,
      }));
    }
    const cards = slideModel.cards || [];
    const cardY = slideModel.lead ? (slideModel.lead.length > 520 ? 3.34 : 3.08) : 1.74;
    const cardH = Math.min(1.16, (6.85 - cardY - 0.12 * Math.max(0, cards.length - 1)) / Math.max(1, cards.length));
    cards.slice(0, 4).forEach((card, index) => {
      addCard({
        slide,
        pptx,
        card,
        x: 8.05,
        y: cardY + index * (cardH + 0.12),
        w: 4.65,
        h: cardH,
      });
    });
    return;
  }

  if (slideModel.kind === "gallery") {
    const items = slideModel.images.slice(0, 6);
    if (items.length === 0) {
      await addImageBox({
        slide,
        pptx,
        image: null,
        x: 0.64,
        y: 1.84,
        w: 12.05,
        h: 5.0,
        cache,
        accent,
      });
      return;
    }

    const columns = items.length === 1 ? 1 : items.length <= 4 ? 2 : 3;
    const rows = Math.ceil(items.length / columns);
    const gap = 0.15;
    const boxW = (12.05 - gap * (columns - 1)) / columns;
    const boxH = (5.02 - gap * (rows - 1)) / rows;

    for (let index = 0; index < items.length; index += 1) {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = 0.64 + column * (boxW + gap);
      const y = 1.84 + row * (boxH + gap);
      await addImageBox({
        slide,
        pptx,
        image: items[index],
        x,
        y,
        w: boxW,
        h: boxH,
        cache,
        accent,
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.1,
        y: y + boxH - 0.38,
        w: boxW - 0.2,
        h: 0.27,
        rectRadius: 0.03,
        fill: { color: "172033", transparency: 15 },
        line: { color: "172033", transparency: 100 },
      });
      slide.addText(items[index].caption || items[index].label || `Visual ${index + 1}`, textOptions({
        x: x + 0.2,
        y: y + boxH - 0.325,
        w: boxW - 0.4,
        h: 0.14,
        color: "FFFFFF",
        fontSize: 7,
        bold: true,
        fit: "shrink",
      }));
    }
    return;
  }

  if (slideModel.kind === "materials") {
    if (slideModel.lead) {
      slide.addText(slideModel.lead, textOptions({
        x: 0.64,
        y: 1.83,
        w: 12.0,
        h: 0.5,
        fontSize: 9.7,
        color: "4C5B6D",
        fit: "shrink",
        valign: "top",
        breakLine: true,
      }));
    }
    const items = slideModel.items.slice(0, 8);
    const columns = 4;
    for (let index = 0; index < items.length; index += 1) {
      const item: PresentationMaterialItem = items[index];
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = 0.64 + column * 3.04;
      const y = 2.42 + row * 2.14;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 2.87,
        h: 1.94,
        rectRadius: 0.05,
        fill: { color: "FFFFFF" },
        line: { color: "D8E1EB", width: 0.8 },
      });
      await addImageBox({
        slide,
        pptx,
        image: item.imageUrl
          ? { url: item.imageUrl, label: item.name, fit: "cover" }
          : null,
        x,
        y,
        w: 2.87,
        h: 0.95,
        cache,
        accent,
      });
      slide.addText(item.name, textOptions({
        x: x + 0.15,
        y: y + 1.06,
        w: 2.57,
        h: 0.23,
        fontSize: 10,
        bold: true,
        fit: "shrink",
      }));
      slide.addText((item.category || "Material").toUpperCase(), textOptions({
        x: x + 0.15,
        y: y + 1.34,
        w: 2.57,
        h: 0.13,
        fontSize: 6.2,
        color: accent,
        bold: true,
        charSpacing: 1.1,
        fit: "shrink",
      }));
      slide.addText(`${item.finish || "Finish to verify"} · ${item.application || "Application to define"}`, textOptions({
        x: x + 0.15,
        y: y + 1.56,
        w: 2.57,
        h: 0.2,
        fontSize: 6.6,
        color: "617084",
        fit: "shrink",
      }));
    }
    return;
  }

  if (slideModel.kind === "table") {
    if (slideModel.lead) {
      slide.addText(slideModel.lead, textOptions({
        x: 0.64,
        y: 1.83,
        w: 12.0,
        h: 0.45,
        fontSize: 9.5,
        color: "4C5B6D",
        fit: "shrink",
        valign: "top",
        breakLine: true,
      }));
    }
    const y = slideModel.lead ? 2.36 : 1.85;
    const columns = slideModel.table.columns;
    const rows = slideModel.table.rows.slice(0, 9);
    const totalW = 12.05;
    const colW = totalW / Math.max(1, columns.length);
    const rowH = Math.min(0.47, (6.78 - y) / Math.max(1, rows.length + 1));

    columns.forEach((column, index) => {
      const x = 0.64 + index * colW;
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: colW,
        h: rowH,
        fill: { color: "172033" },
        line: { color: "172033", width: 0.4 },
      });
      slide.addText(column.toUpperCase(), textOptions({
        x: x + 0.11,
        y: y + 0.06,
        w: colW - 0.22,
        h: rowH - 0.12,
        fontSize: 6.8,
        color: "FFFFFF",
        bold: true,
        charSpacing: 1,
        fit: "shrink",
      }));
    });

    rows.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        const x = 0.64 + columnIndex * colW;
        const rowY = y + rowH * (rowIndex + 1);
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y: rowY,
          w: colW,
          h: rowH,
          fill: { color: rowIndex % 2 === 0 ? "FFFFFF" : "F5F7FA" },
          line: { color: "DFE6EE", width: 0.4 },
        });
        slide.addText(cell, textOptions({
          x: x + 0.11,
          y: rowY + 0.055,
          w: colW - 0.22,
          h: rowH - 0.11,
          fontSize: 7.2,
          color: columnIndex === 0 ? "18202B" : "526174",
          bold: columnIndex === 0,
          fit: "shrink",
        }));
      });
    });
    return;
  }

  if (slideModel.kind === "disclaimer") {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.72,
      y: 2.1,
      w: 1.38,
      h: 1.38,
      rectRadius: 0.12,
      fill: { color: accent },
      line: { color: accent, width: 0.5 },
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 1.335,
      y: 2.36,
      w: 0.14,
      h: 0.64,
      rectRadius: 0.07,
      fill: { color: "FFFFFF" },
      line: { color: "FFFFFF", transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: 1.325,
      y: 3.12,
      w: 0.16,
      h: 0.16,
      fill: { color: "FFFFFF" },
      line: { color: "FFFFFF", transparency: 100 },
    });
    slideModel.paragraphs.forEach((paragraph, index) => {
      slide.addText(paragraph, textOptions({
        x: 2.42,
        y: 1.95 + index * 1.18,
        w: 10.0,
        h: 0.86,
        fontSize: 11,
        color: "46566B",
        fit: "shrink",
        valign: "top",
        breakLine: true,
      }));
    });
    await addBrand({
      slide,
      cache,
      accent,
      x: 2.42,
      y: 5.75,
      wordmarkW: 0.9,
      wordmarkH: 0.56,
    });
  }
}

export async function exportPresentationPptx(document: PresentationDocument) {
  const imported = await import("pptxgenjs");
  const PptxGenJS: any = imported.default;
  const pptx: any = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Heyy Studio";
  pptx.company = "Heyy Studio";
  pptx.subject = document.studioLabel;
  pptx.title = document.title;
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  const accent = hex(document.accentHex);
  const cache = new Map<string, Promise<ResolvedImage | null>>();

  for (let index = 0; index < document.slides.length; index += 1) {
    await renderSlide({
      pptx,
      slideModel: document.slides[index],
      page: index + 1,
      accent,
      cache,
    });
  }

  await pptx.writeFile({ fileName: `${document.filenameBase}.pptx` });
}
