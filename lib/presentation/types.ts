export type PresentationTone = "purple" | "blue" | "green" | "amber" | "neutral";
export type PresentationImageFit = "cover" | "contain";

export type PresentationMetric = {
  label: string;
  value: string;
};

export type PresentationCard = {
  title: string;
  body: string;
  tone?: PresentationTone;
};

export type PresentationImage = {
  url: string;
  label?: string;
  caption?: string;
  fit?: PresentationImageFit;
};

export type PresentationPaletteItem = {
  name: string;
  hex: string;
  rgb?: string;
  cmyk?: string;
};

export type PresentationTypographyItem = {
  name: string;
  role?: string;
  sample?: string;
  reason?: string;
};

export type PresentationMaterialItem = {
  name: string;
  category?: string;
  finish?: string;
  application?: string;
  imageUrl?: string | null;
};

export type PresentationTable = {
  columns: string[];
  rows: string[][];
};

export type PresentationSlide =
  | {
      id: string;
      kind: "cover";
      eyebrow: string;
      title: string;
      subtitle?: string;
      meta?: string;
      image?: PresentationImage | null;
      logo?: PresentationImage | null;
      tone?: PresentationTone;
    }
  | {
      id: string;
      kind: "content";
      number?: string;
      eyebrow: string;
      title: string;
      lead?: string;
      metrics?: PresentationMetric[];
      cards?: PresentationCard[];
      footer?: string;
      tone?: PresentationTone;
    }
  | {
      id: string;
      kind: "palette";
      number?: string;
      eyebrow: string;
      title: string;
      items: PresentationPaletteItem[];
      footer?: string;
    }
  | {
      id: string;
      kind: "typography";
      number?: string;
      eyebrow: string;
      title: string;
      items: PresentationTypographyItem[];
      footer?: string;
    }
  | {
      id: string;
      kind: "imageText";
      number?: string;
      eyebrow: string;
      title: string;
      image?: PresentationImage | null;
      lead?: string;
      cards?: PresentationCard[];
      footer?: string;
      tone?: PresentationTone;
    }
  | {
      id: string;
      kind: "gallery";
      number?: string;
      eyebrow: string;
      title: string;
      images: PresentationImage[];
      footer?: string;
      tone?: PresentationTone;
    }
  | {
      id: string;
      kind: "materials";
      number?: string;
      eyebrow: string;
      title: string;
      items: PresentationMaterialItem[];
      lead?: string;
      footer?: string;
    }
  | {
      id: string;
      kind: "table";
      number?: string;
      eyebrow: string;
      title: string;
      lead?: string;
      table: PresentationTable;
      footer?: string;
      tone?: PresentationTone;
    }
  | {
      id: string;
      kind: "disclaimer";
      number?: string;
      eyebrow: string;
      title: string;
      paragraphs: string[];
      footer?: string;
      tone?: PresentationTone;
    };

export type PresentationDocument = {
  id: string;
  title: string;
  filenameBase: string;
  studioLabel: string;
  accentHex: string;
  slides: PresentationSlide[];
};
