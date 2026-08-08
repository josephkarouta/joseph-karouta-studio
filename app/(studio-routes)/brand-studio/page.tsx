"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Check,
  FileOutput,
  Focus,
  LayoutTemplate,
  PackageCheck,
  Palette,
  PenTool,
  RefreshCw,
  Rocket,
  Shapes,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { CreditPill, Eyebrow, PageContainer } from "@/components/ui/heyy";
import HeyySelect from "@/components/ui/heyy-select";
import HeyyMultiSelect from "@/components/ui/heyy-multi-select";
import AuthModal from "@/app/AuthModal";
import StudioAccessGate from "@/components/studio-access-gate";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { CREDIT_COSTS } from "@/lib/credits/config";
import {
  BRAND_APPLICATION_FIELDS,
  BRAND_AUDIENCES,
  BRAND_DELIVERABLES,
  BRAND_INDUSTRIES,
  BRAND_JOURNEYS,
  BRAND_STYLES,
  LOGO_DECISIONS,
  buildBrandJourneySnapshot,
  buildLocalBrandSystem,
  getApplicationDeliverables,
  getBrandDeliverable,
  getBrandJourney,
  shouldGenerateBrandBlueprint,
  workspaceSectionLabels,
  type BrandApplicationBriefs,
  type BrandDirectionMode,
  type BrandJourneyId,
  type BrandLogoAction,
} from "@/lib/brand/project-templates";

const BLUEPRINT_LOADING_STEPS = [
  "Reading your selected brand journey",
  "Structuring the strategy and project scope",
  "Creating the requested concept directions",
  "Preparing the relevant identity modules",
  "Saving the Brand Studio workspace",
];

const FOCUSED_LOADING_STEPS = [
  "Reading the selected project scope",
  "Connecting the existing logo",
  "Preparing the application brief",
  "Creating only the required workspace sections",
  "Saving the Brand Studio workspace",
];

type BrandPrimaryGoalId = "new-brand" | "rebrand" | "existing-logo" | "focused";

const BRAND_PRIMARY_GOALS: Array<{
  id: BrandPrimaryGoalId;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "new-brand", title: "Create a new brand", description: "Build the strategy, identity and launch-ready core from the beginning.", icon: Rocket },
  { id: "rebrand", title: "Rebrand a business", description: "Keep what has value and create a clearer, stronger identity system.", icon: RefreshCw },
  { id: "existing-logo", title: "Build around an existing logo", description: "Use the approved mark and develop the system and applications around it.", icon: BadgeCheck },
  { id: "focused", title: "Create one focused deliverable", description: "Start with a logo, guidelines, stationery or one practical brand item.", icon: Focus },
];

const FOCUSED_JOURNEY_IDS: BrandJourneyId[] = [
  "logo-only",
  "guidelines-only",
  "stationery",
  "single-item",
  "full-identity",
  "custom",
];

const JOURNEY_ICONS: Partial<Record<BrandJourneyId, LucideIcon>> = {
  "logo-only": PenTool,
  "guidelines-only": BookOpenCheck,
  stationery: BriefcaseBusiness,
  "single-item": LayoutTemplate,
  "full-identity": Boxes,
  custom: Sparkles,
};

const DELIVERABLE_ICONS: Record<string, LucideIcon> = {
  strategy: WandSparkles,
  "creative-direction": Palette,
  logo: PenTool,
  guidelines: BookOpenCheck,
  "business-card": BriefcaseBusiness,
  letterhead: FileOutput,
  envelope: PackageCheck,
  "email-signature": BadgeCheck,
  presentation: LayoutTemplate,
  "social-system": Shapes,
  website: LayoutTemplate,
  packaging: PackageCheck,
  signage: Shapes,
  merchandise: Boxes,
};

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type PreparedLogoUpload = {
  file: File;
  originalFileName: string;
  originalMimeType: string;
  convertedFromSvg: boolean;
};

type SharedBrandContact = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

function compactContactLine(contact: SharedBrandContact) {
  return [contact.phone, contact.email, contact.website]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function applicationAutofillDefaults(
  applicationId: string,
  contact: SharedBrandContact,
): Record<string, string> {
  const contactLine = compactContactLine(contact);

  switch (applicationId) {
    case "business-card":
      return {
        phone: contact.phone,
        email: contact.email,
        website: contact.website,
        address: contact.address,
      };
    case "letterhead":
      return {
        legalName: contact.businessName,
        address: contact.address,
        contact: contactLine,
      };
    case "envelope":
      return { returnAddress: contact.address };
    case "email-signature":
      return { contact: contactLine };
    default:
      return {};
  }
}

function logoFileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

function isSvgLogo(file: File) {
  return file.type.toLowerCase() === "image/svg+xml" || logoFileExtension(file) === "svg";
}

function isSupportedRasterLogo(file: File) {
  const type = file.type.toLowerCase();
  const extension = logoFileExtension(file);
  return (
    ["image/png", "image/jpeg", "image/webp"].includes(type) ||
    ["png", "jpg", "jpeg", "webp"].includes(extension)
  );
}

function parsePositiveSvgNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitiseSvgDocument(svgText: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, "image/svg+xml");

  if (document.querySelector("parsererror")) {
    throw new Error("The SVG logo could not be read. Export it again or upload a PNG.");
  }

  document
    .querySelectorAll("script, foreignObject, iframe, object, embed")
    .forEach((element) => element.remove());

  document.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (
        (name === "href" || name === "xlink:href") &&
        value &&
        !value.startsWith("#") &&
        !value.startsWith("data:image/")
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  document.querySelectorAll("style").forEach((styleElement) => {
    const css = styleElement.textContent || "";
    styleElement.textContent = css
      .replace(/@import[^;]+;?/gi, "")
      .replace(/url\(\s*(['"]?)(?!data:image\/|#)[^)]+\1\s*\)/gi, "none");
  });

  return document;
}

async function svgLogoToPng(file: File) {
  const svgText = await file.text();
  const svgDocument = sanitiseSvgDocument(svgText);
  const root = svgDocument.documentElement;

  const viewBox = (root.getAttribute("viewBox") || "")
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value));
  const viewBoxWidth =
    viewBox.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2] > 0
      ? viewBox[2]
      : null;
  const viewBoxHeight =
    viewBox.length === 4 && Number.isFinite(viewBox[3]) && viewBox[3] > 0
      ? viewBox[3]
      : null;

  const sourceWidth = parsePositiveSvgNumber(root.getAttribute("width")) || viewBoxWidth || 1200;
  const sourceHeight = parsePositiveSvgNumber(root.getAttribute("height")) || viewBoxHeight || 800;

  if (!root.getAttribute("xmlns")) {
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const serialisedSvg = new XMLSerializer().serializeToString(root);
  const svgBlob = new Blob([serialisedSvg], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "The SVG logo could not be converted. Export it as PNG, JPG or WebP and try again.",
          ),
        );
      image.src = objectUrl;
    });

    const targetMaxDimension = 1600;
    const scale = targetMaxDimension / Math.max(sourceWidth, sourceHeight);
    const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
    const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = window.document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The browser could not prepare the SVG logo preview.");
    }

    context.clearRect(0, 0, outputWidth, outputHeight);
    context.drawImage(image, 0, 0, outputWidth, outputHeight);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("The browser could not convert the SVG logo to PNG.")),
        "image/png",
        1,
      );
    });

    const baseName =
      safeFileName(file.name.replace(/\.svg$/i, "")) || "existing-logo";

    return new File([pngBlob], `${baseName}-preview.png`, {
      type: "image/png",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareLogoUpload(file: File): Promise<PreparedLogoUpload> {
  if (isSvgLogo(file)) {
    return {
      file: await svgLogoToPng(file),
      originalFileName: file.name,
      originalMimeType: file.type || "image/svg+xml",
      convertedFromSvg: true,
    };
  }

  if (!isSupportedRasterLogo(file)) {
    throw new Error("Upload a PNG, JPG, WebP or SVG logo.");
  }

  return {
    file,
    originalFileName: file.name,
    originalMimeType: file.type || `image/${logoFileExtension(file)}`,
    convertedFromSvg: false,
  };
}

export default function BrandStudioPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");

  const [journeyId, setJourneyId] = useState<BrandJourneyId>("new-brand");
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [customStyle, setCustomStyle] = useState("");
  const [description, setDescription] = useState("");
  const [preserveNotes, setPreserveNotes] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  const [customScope, setCustomScope] = useState("");
  const [existingLogoFile, setExistingLogoFile] = useState<File | null>(null);
  const [logoAction, setLogoAction] = useState<BrandLogoAction>("create");
  const [directionMode, setDirectionMode] = useState<BrandDirectionMode>("explore");
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([
    "strategy",
    "creative-direction",
    "logo",
    "guidelines",
  ]);
  const [applicationBriefs, setApplicationBriefs] = useState<BrandApplicationBriefs>({});
  const previousAutofillRef = useRef<BrandApplicationBriefs>({});

  const journey = getBrandJourney(journeyId);
  const finalIndustry = selectedIndustry === "Other" ? customIndustry : selectedIndustry;
  const finalAudience = [
    ...selectedAudiences.filter((item) => item !== "Other"),
    ...(selectedAudiences.includes("Other") && customAudience.trim()
      ? [customAudience.trim()]
      : []),
  ].join(", ");
  const finalStyle = [
    ...selectedStyles.filter((item) => item !== "Other"),
    ...(selectedStyles.includes("Other") && customStyle.trim()
      ? [customStyle.trim()]
      : []),
  ].join(", ");
  const needsExistingLogo = journey.requiresExistingLogo;
  const singleItem = journeyId === "single-item";
  const primaryGoal: BrandPrimaryGoalId = ["new-brand", "rebrand", "existing-logo"].includes(journeyId)
    ? (journeyId as BrandPrimaryGoalId)
    : "focused";
  const selectedApplications = useMemo(
    () => getApplicationDeliverables(selectedDeliverables),
    [selectedDeliverables],
  );
  const selectedScopeNeedsLogo = selectedApplications.some((item) => item.requiresLogo);
  const showCurrentIdentity = needsExistingLogo || journey.allowLogoChoice;
  const scopeStepNumber = showCurrentIdentity ? "04" : "03";
  const applicationStepNumber = showCurrentIdentity ? "05" : "04";
  const draftJourney = buildBrandJourneySnapshot({
    journeyId,
    selectedDeliverables,
    logoAction,
    directionMode,
    hasExistingLogo: Boolean(existingLogoFile),
    preserveNotes,
    changeNotes,
    customScope,
    applicationBriefs,
    contactDetails: {
      businessName: businessName.trim(),
      address: businessAddress.trim(),
      phone: businessPhone.trim(),
      email: businessEmail.trim(),
      website: businessWebsite.trim(),
    },
    projectName: businessName.trim() || "Brand Project",
  });
  const activeLoadingSteps = shouldGenerateBrandBlueprint(draftJourney)
    ? BLUEPRINT_LOADING_STEPS
    : FOCUSED_LOADING_STEPS;
  const visibleDeliverables = useMemo(() => {
    const applicationIds = new Set(
      BRAND_DELIVERABLES
        .filter((item) => !["strategy", "creative-direction", "logo", "guidelines"].includes(item.id))
        .map((item) => item.id),
    );

    return BRAND_DELIVERABLES.filter((item) => {
      if (journeyId === "single-item") return applicationIds.has(item.id);
      if (journeyId === "stationery") return item.category === "Stationery";
      if (journeyId === "logo-only") return item.id === "logo";
      if (journeyId === "guidelines-only") return item.id === "guidelines";
      if (journeyId === "existing-logo") return item.id !== "logo";
      return true;
    });
  }, [journeyId]);
  const visibleLogoDecisions = useMemo(() => {
    if (["single-item", "stationery", "guidelines-only"].includes(journeyId)) {
      return LOGO_DECISIONS.filter((item) => item.id === "keep");
    }
    if (journeyId === "existing-logo") {
      return LOGO_DECISIONS.filter((item) => ["keep", "refine", "create"].includes(item.id));
    }
    return LOGO_DECISIONS;
  }, [journeyId]);

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user);
      setCheckingAuth(false);
    }

    void checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
        setCheckingAuth(false);
        if (session?.user) setShowAuth(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const nextJourney = getBrandJourney(journeyId);
    setSelectedDeliverables(nextJourney.defaultDeliverables);
    setLogoAction(nextJourney.logoAction);
    setDirectionMode(nextJourney.directionMode);
    setExistingLogoFile(null);
    setPreserveNotes("");
    setChangeNotes("");
    setApplicationBriefs({});
    previousAutofillRef.current = {};
  }, [journeyId]);

  useEffect(() => {
    if (logoAction === "create" || logoAction === "refine") {
      setSelectedDeliverables((current) =>
        current.includes("logo") ? current : [...current, "logo"],
      );
    } else {
      setSelectedDeliverables((current) => current.filter((item) => item !== "logo"));
    }
  }, [logoAction]);

  useEffect(() => {
    setSelectedDeliverables((current) => {
      const withoutDirection = current.filter((item) => item !== "creative-direction");
      return journey.allowDirectionChoice && directionMode === "explore"
        ? [...withoutDirection, "creative-direction"]
        : withoutDirection;
    });
  }, [directionMode, journey.allowDirectionChoice]);

  useEffect(() => {
    const sharedContact: SharedBrandContact = {
      businessName: businessName.trim(),
      address: businessAddress.trim(),
      phone: businessPhone.trim(),
      email: businessEmail.trim(),
      website: businessWebsite.trim(),
    };
    const nextDefaults: BrandApplicationBriefs = {};

    for (const application of selectedApplications) {
      nextDefaults[application.id] = applicationAutofillDefaults(
        application.id,
        sharedContact,
      );
    }

    setApplicationBriefs((current) => {
      let changed = false;
      const next = { ...current };

      for (const application of selectedApplications) {
        const applicationId = application.id;
        const defaults = nextDefaults[applicationId] || {};
        const previousDefaults = previousAutofillRef.current[applicationId] || {};
        const currentBrief = { ...(current[applicationId] || {}) };

        for (const [fieldId, defaultValue] of Object.entries(defaults)) {
          const currentValue = currentBrief[fieldId] || "";
          const previousValue = previousDefaults[fieldId] || "";
          if (!currentValue.trim() || currentValue === previousValue) {
            if (currentValue !== defaultValue) {
              currentBrief[fieldId] = defaultValue;
              changed = true;
            }
          }
        }

        if (!current[applicationId]) changed = true;
        next[applicationId] = currentBrief;
      }

      return changed ? next : current;
    });

    previousAutofillRef.current = nextDefaults;
  }, [
    businessAddress,
    businessEmail,
    businessName,
    businessPhone,
    businessWebsite,
    selectedApplications,
  ]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, activeLoadingSteps.length - 1));
    }, 1200);
    return () => window.clearInterval(interval);
  }, [isGenerating, activeLoadingSteps.length]);


  function selectPrimaryGoal(goalId: BrandPrimaryGoalId) {
    if (goalId === "focused") {
      if (!FOCUSED_JOURNEY_IDS.includes(journeyId)) setJourneyId("logo-only");
      return;
    }
    setJourneyId(goalId);
  }

  function toggleDeliverable(id: string) {
    setSelectedDeliverables((current) => {
      if (singleItem) return [id];
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  }

  function updateApplicationBrief(deliverableId: string, fieldId: string, value: string) {
    setApplicationBriefs((current) => ({
      ...current,
      [deliverableId]: {
        ...(current[deliverableId] || {}),
        [fieldId]: value,
      },
    }));
  }

  async function uploadExistingLogo(
    projectId: string,
    currentBrandSystem: any,
    preparedLogo: PreparedLogoUpload | null,
  ) {
    if (!preparedLogo || !user) return currentBrandSystem;

    const uploadFile = preparedLogo.file;
    const fileName = safeFileName(uploadFile.name || "existing-logo.png");
    const path = `${user.id}/${projectId}/existing-logo-${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(path, uploadFile, {
        contentType: uploadFile.type || "image/png",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from("project-assets").getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const { error: assetError } = await supabase.from("project_assets").insert({
      user_id: user.id,
      project_id: projectId,
      project_type: "brand",
      asset_type: "existing_logo",
      title: `Existing Logo - ${businessName}`,
      input_payload: {
        fileName: preparedLogo.originalFileName,
        mimeType: preparedLogo.originalMimeType,
        storedFileName: uploadFile.name,
        storedMimeType: uploadFile.type,
        convertedFromSvg: preparedLogo.convertedFromSvg,
      },
      output_payload: {
        source: "brand-studio-intake",
        storagePath: path,
        logoAction,
      },
      file_url: publicUrl,
      thumbnail_url: publicUrl,
    });

    if (assetError) {
      await supabase.storage.from("project-assets").remove([path]);
      throw assetError;
    }

    return {
      ...currentBrandSystem,
      projectJourney: {
        ...(currentBrandSystem?.projectJourney || {}),
        hasExistingLogo: true,
        existingLogoUrl: publicUrl,
        existingLogoStoragePath: path,
        existingLogoOriginalFileName: preparedLogo.originalFileName,
        existingLogoOriginalMimeType: preparedLogo.originalMimeType,
        existingLogoConvertedFromSvg: preparedLogo.convertedFromSvg,
      },
    };
  }

  async function handleBuildBrand() {
    setError("");

    if (!businessName.trim() || !finalIndustry.trim() || !finalAudience.trim() || !finalStyle.trim()) {
      setError("Complete the business name, industry, audience and style direction.");
      return;
    }

    if (!selectedDeliverables.length && journeyId !== "custom") {
      setError("Select at least one item for this Brand Studio project.");
      return;
    }

    if (journeyId === "custom" && !customScope.trim()) {
      setError("Describe the custom scope before creating the workspace.");
      return;
    }

    if (selectedScopeNeedsLogo && logoAction === "none") {
      setError("The selected application needs a logo. Upload the current logo or choose Create a new logo.");
      return;
    }

    if ((needsExistingLogo || selectedScopeNeedsLogo || journey.allowLogoChoice) && (logoAction === "keep" || logoAction === "refine") && !existingLogoFile) {
      setError("Upload the current logo, or choose Create a new logo.");
      return;
    }

    for (const application of selectedApplications) {
      const requiredFields = (BRAND_APPLICATION_FIELDS[application.id] || []).filter((field) => field.required);
      const missing = requiredFields.find((field) => !applicationBriefs[application.id]?.[field.id]?.trim());
      if (missing) {
        setError(`Complete ${application.label}: ${missing.label}.`);
        return;
      }
    }

    if (!user?.id) {
      setShowAuth(true);
      return;
    }

    let createdProjectId: string | null = null;

    try {
      setIsGenerating(true);
      setLoadingStep(0);

      const preparedLogo = existingLogoFile
        ? await prepareLogoUpload(existingLogoFile)
        : null;

      const projectJourney = buildBrandJourneySnapshot({
        journeyId,
        selectedDeliverables,
        logoAction,
        directionMode,
        hasExistingLogo: Boolean(existingLogoFile),
        preserveNotes,
        changeNotes,
        customScope,
        applicationBriefs,
        contactDetails: {
          businessName: businessName.trim(),
          address: businessAddress.trim(),
          phone: businessPhone.trim(),
          email: businessEmail.trim(),
          website: businessWebsite.trim(),
        },
        projectName: businessName.trim(),
      });

      const requestPayload = {
        businessName: businessName.trim(),
        industry: finalIndustry.trim(),
        audience: finalAudience.trim(),
        style: finalStyle.trim(),
        description: description.trim(),
        projectJourney,
      };

      let brandSystem = buildLocalBrandSystem(requestPayload);

      if (shouldGenerateBrandBlueprint(projectJourney)) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Your session expired. Sign in again.");
        const response = await fetch("/api/brand-studio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(requestPayload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to prepare the Brand Studio workspace.");
        }

        brandSystem = {
          ...data.brandSystem,
          projectJourney,
        };
      }

      const { data: savedProject, error: saveError } = await supabase
        .from("brand_projects")
        .insert({
          user_id: user.id,
          project_name: businessName.trim(),
          industry: finalIndustry.trim(),
          audience: finalAudience.trim(),
          style: finalStyle.trim(),
          description: description.trim(),
          brand_system_json: brandSystem,
        })
        .select("id")
        .single();

      if (saveError || !savedProject?.id) {
        throw saveError || new Error("The Brand Studio project could not be saved.");
      }

      createdProjectId = savedProject.id;

      const finalBrandSystem = await uploadExistingLogo(
        savedProject.id,
        brandSystem,
        preparedLogo,
      );
      if (finalBrandSystem !== brandSystem) {
        const { error: updateError } = await supabase
          .from("brand_projects")
          .update({ brand_system_json: finalBrandSystem })
          .eq("id", savedProject.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      }

      setLoadingStep(activeLoadingSteps.length - 1);
      window.setTimeout(() => {
        window.location.href = `/dashboard/brand/${savedProject.id}`;
      }, 500);
    } catch (creationError) {
      console.error(creationError);

      if (createdProjectId && user?.id) {
        await supabase
          .from("brand_projects")
          .delete()
          .eq("id", createdProjectId)
          .eq("user_id", user.id);
      }

      setError(
        creationError instanceof Error
          ? creationError.message
          : "The Brand Studio workspace could not be created.",
      );
      setIsGenerating(false);
    }
  }

  const dynamicSummary = selectedDeliverables
    .map((id) => getBrandDeliverable(id))
    .filter(Boolean);
  const workspaceSummary = workspaceSectionLabels({
    workspaceSections: draftJourney.workspaceSections,
    selectedDeliverables: draftJourney.selectedDeliverables,
  });

  const content = (
    <main className="heyy-page brand-studio-v13 min-h-screen py-8 sm:py-10">
      <style>{`
        .brand-studio-v13 { --brand-accent:#a13df0; --brand-accent-strong:#c88cff; --brand-soft:rgba(190,89,235,.15); }
        .brand-choice[data-selected="true"] {
          border-color: var(--brand-accent) !important;
          background: linear-gradient(135deg,rgba(161,61,240,.18),var(--surface-strong)) !important;
          box-shadow: 0 0 0 2px var(--brand-accent), 0 16px 34px rgba(159,44,224,.22) !important;
        }
        .brand-choice[data-selected="true"] .brand-choice-mark {
          background: var(--brand-accent) !important;
          color:#fff !important;
        }
        .brand-choice[data-selected="true"] .brand-choice-mark svg {
          color:#fff !important;
          stroke:#fff !important;
        }
        .brand-choice:hover { border-color:var(--brand-accent) !important; background:var(--surface-hover) !important; }
        .brand-compact-choice[data-selected="true"] {
          border-color: var(--brand-accent) !important;
          background: var(--brand-accent) !important;
          color: #fff !important;
          box-shadow: 0 8px 18px rgba(159,44,224,.23) !important;
        }
        .brand-compact-choice[data-selected="true"] span { color:#fff !important; }
        .brand-studio-v13 .bg-white { background:var(--surface-strong) !important; }
        .brand-studio-v13 .bg-slate-50 { background:var(--surface) !important; }
        .brand-studio-v13 .border-slate-100, .brand-studio-v13 .border-slate-200 { border-color:var(--border) !important; }
        .brand-studio-v13 .text-slate-950, .brand-studio-v13 .text-slate-900, .brand-studio-v13 .text-slate-800, .brand-studio-v13 .text-slate-700 { color:var(--text-primary) !important; }
        .brand-studio-v13 .text-slate-600, .brand-studio-v13 .text-slate-500 { color:var(--text-secondary) !important; }
        .brand-studio-v13 .text-slate-400 { color:var(--text-muted) !important; }
        .brand-studio-v13 .border-violet-200 { border-color:rgba(190,89,235,.30) !important; }
        .brand-studio-v13 .bg-violet-50\/50 { background:var(--brand-soft) !important; }
        [data-theme="dark"] .brand-studio-v13 .bg-violet-50, [data-theme="dark"] .brand-studio-v13 .bg-violet-100 { background:rgba(190,89,235,.13) !important; }
        [data-theme="dark"] .brand-studio-v13 .bg-amber-50 { background:rgba(240,180,41,.11) !important; }
        [data-theme="dark"] .brand-studio-v13 .text-amber-800, [data-theme="dark"] .brand-studio-v13 .text-amber-700 { color:#ffd27a !important; }
        @keyframes brandLoaderMove { from { transform:translateX(-120%); } to { transform:translateX(340%); } }
      `}</style>

      <PageContainer>
        <section className="relative overflow-hidden rounded-[2rem] border p-6 shadow-[var(--shadow-card)] sm:p-9" style={{ borderColor:"rgba(190,89,235,.34)", background:"linear-gradient(120deg,rgba(190,89,235,.16),var(--surface-strong),rgba(239,63,180,.08))" }}>
          <div className="absolute -right-14 -top-20 h-56 w-56 rounded-full border-[34px] border-white/20" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <Eyebrow style={{ color:"#a13df0" }}>Strategy, identity & brand applications</Eyebrow>
              <h1 className="mt-4 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">Brand Studio</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[var(--text-secondary)] sm:text-base">Build a complete brand system or one focused deliverable inside a clear, connected workspace.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl">
              <CreditPill credits={CREDIT_COSTS.brandSystemText} />
              <span className="text-xs font-bold text-[var(--text-secondary)]">for a full brand blueprint</span>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <Panel eyebrow="01 · Project Goal" title="What are you creating?" description="Choose one clear starting point. The next questions adapt to the goal, so you only see what this project needs.">
              <div className="grid gap-3 md:grid-cols-2">
                {BRAND_PRIMARY_GOALS.map((item) => {
                  const selected = primaryGoal === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectPrimaryGoal(item.id)}
                      data-selected={selected ? "true" : "false"}
                      className="brand-choice group min-h-[132px] rounded-[22px] border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-4">
                        <span className="brand-choice-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                          <Icon size={20} strokeWidth={2.1} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-black text-slate-950">{item.title}</h3>
                            {selected && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><Check size={14} strokeWidth={3} /></span>}
                          </div>
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {primaryGoal === "focused" && (
                <div className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-violet-600 text-white"><LayoutTemplate size={17} /></span>
                    <div>
                      <p className="text-sm font-black text-slate-950">Choose the focused workspace</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">You can expand the scope later without restarting the project.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {FOCUSED_JOURNEY_IDS.map((id) => {
                      const item = BRAND_JOURNEYS.find((journeyItem) => journeyItem.id === id);
                      if (!item) return null;
                      const selected = journeyId === id;
                      const Icon = JOURNEY_ICONS[id] || Sparkles;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setJourneyId(id)}
                          data-selected={selected ? "true" : "false"}
                          className="brand-choice flex min-h-[76px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white p-3 text-left transition"
                        >
                          <span className="brand-choice-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-violet-100 text-violet-700"><Icon size={17} /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-black text-slate-950">{item.shortTitle}</span>
                            <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500">{item.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Panel>

            <Panel eyebrow="02 · Brand Context" title="Tell us about the business" description="A few focused inputs are enough. Heyy Studio turns them into a structured professional brief.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Business name">
                  <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Enter the business or project name" className="brand-input" />
                </Field>
                <Field label="Industry">
                  <HeyySelect
                    value={selectedIndustry}
                    options={BRAND_INDUSTRIES}
                    onChange={setSelectedIndustry}
                    placeholder="Choose an industry"
                    ariaLabel="Industry"
                    tone="brand"
                  />
                  {selectedIndustry === "Other" && <input value={customIndustry} onChange={(event) => setCustomIndustry(event.target.value)} placeholder="Describe the industry" className="brand-input mt-3" />}
                </Field>
                <Field label="Primary audience">
                  <HeyyMultiSelect
                    value={selectedAudiences}
                    options={BRAND_AUDIENCES}
                    onChange={setSelectedAudiences}
                    placeholder="Choose one or more audiences"
                    ariaLabel="Primary audience"
                    tone="brand"
                  />
                  {selectedAudiences.includes("Other") && <input value={customAudience} onChange={(event) => setCustomAudience(event.target.value)} placeholder="Describe the additional audience" className="brand-input mt-3" />}
                </Field>
                <Field label="Style direction">
                  <HeyyMultiSelect
                    value={selectedStyles}
                    options={BRAND_STYLES}
                    onChange={setSelectedStyles}
                    placeholder="Choose one or more style directions"
                    ariaLabel="Style direction"
                    tone="brand"
                  />
                  {selectedStyles.includes("Other") && <input value={customStyle} onChange={(event) => setCustomStyle(event.target.value)} placeholder="Describe the additional visual style" className="brand-input mt-3" />}
                </Field>
              </div>

              <div className="rounded-[20px] border border-violet-200 bg-violet-50/50 p-4 sm:p-5">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Shared application details</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Add these once. Heyy Studio will automatically prefill matching Business Card, Letterhead, Envelope and Email Signature fields without overwriting your manual edits.</p>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Business address">
                    <textarea value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} placeholder="Address used across relevant applications" className="brand-input min-h-[92px] resize-y" />
                  </Field>
                  <div className="grid gap-4">
                    <Field label="Business phone">
                      <input value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} placeholder="+61 ..." className="brand-input" />
                    </Field>
                    <Field label="Business email">
                      <input value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} placeholder="hello@business.com" className="brand-input" />
                    </Field>
                    <Field label="Website">
                      <input value={businessWebsite} onChange={(event) => setBusinessWebsite(event.target.value)} placeholder="business.com" className="brand-input" />
                    </Field>
                  </div>
                </div>
              </div>

              <Field label="What should the brand achieve?">
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the business goal, what people should understand or feel, important competitors, preferences and anything the creative team should know." className="brand-input min-h-[118px] resize-y" />
              </Field>
            </Panel>

            {showCurrentIdentity && (
              <Panel eyebrow="03 · Current Identity" title="What should happen to the current logo?" description="The logo journey should never be assumed. Choose exactly what Heyy Studio should preserve, refine or create.">
                {journey.allowLogoChoice && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleLogoDecisions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLogoAction(item.id)}
                        data-selected={logoAction === item.id ? "true" : "false"}
                        className="brand-choice rounded-[18px] border border-slate-200 bg-white p-4 text-left transition hover:border-violet-400"
                      >
                        <p className="text-sm font-black text-slate-950">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
                      </button>
                    ))}
                  </div>
                )}

                {logoAction !== "create" && logoAction !== "none" && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <Field label="Upload current logo">
                      <label className="flex min-h-[118px] cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-violet-300 bg-violet-50 px-4 text-center transition hover:border-violet-600 hover:bg-violet-100">
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => setExistingLogoFile(event.target.files?.[0] || null)} />
                        <span className="text-sm font-black text-violet-700">{existingLogoFile ? existingLogoFile.name : "Choose logo file"}</span>
                        <span className="mt-1 text-xs text-violet-500">
                          PNG, JPG, WebP or SVG
                          {existingLogoFile && isSvgLogo(existingLogoFile)
                            ? " · SVG will be converted safely to a transparent PNG preview"
                            : ""}
                        </span>
                      </label>
                    </Field>
                    <div className="grid gap-3">
                      <Field label="What must be preserved?">
                        <textarea value={preserveNotes} onChange={(event) => setPreserveNotes(event.target.value)} placeholder="Recognition, symbol, colour, wordmark, history or any non-negotiable element." className="brand-input min-h-[95px] resize-y" />
                      </Field>
                      <Field label="What should change?">
                        <textarea value={changeNotes} onChange={(event) => setChangeNotes(event.target.value)} placeholder="Explain what feels dated, unclear, inconsistent or unsuitable." className="brand-input min-h-[95px] resize-y" />
                      </Field>
                    </div>
                  </div>
                )}
              </Panel>
            )}

            <Panel eyebrow={`${scopeStepNumber} · Project Scope`} title="Choose what this project should include" description={singleItem ? "Choose one focused deliverable. You can add more later from the project workspace." : "Select only the modules and applications you need. Expert production remains available for every selected item."}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleDeliverables.map((item) => {
                  const selected = selectedDeliverables.includes(item.id);
                  const Icon = DELIVERABLE_ICONS[item.id] || Shapes;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleDeliverable(item.id)}
                      data-selected={selected ? "true" : "false"}
                      className="brand-choice flex min-h-[78px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white p-3 text-left transition"
                    >
                      <span className="brand-choice-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-slate-600">
                        <Icon size={18} strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-violet-600">{item.category}</span>
                        <span className="mt-1 block text-sm font-black text-slate-950">{item.label}</span>
                      </span>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${selected ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {selected ? <Check size={14} strokeWidth={3} /> : <span className="text-base font-black">+</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              {dynamicSummary.length > 0 && (
                <div className="rounded-[18px] border border-violet-200 bg-violet-50/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">Selected scope</p>
                      <p className="mt-1 text-sm font-black text-slate-950">{dynamicSummary.length} deliverable{dynamicSummary.length === 1 ? "" : "s"} will be created inside one connected project.</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-violet-600 text-white"><PackageCheck size={18} /></span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dynamicSummary.map((item) => (
                      <span key={item!.id} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-black text-violet-700">{item!.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {journeyId === "custom" && (
                <Field label="Custom project scope">
                  <textarea value={customScope} onChange={(event) => setCustomScope(event.target.value)} placeholder="Describe the exact brand item, identity support or project outcome required." className="brand-input min-h-[112px] resize-y" />
                </Field>
              )}

              {journey.allowDirectionChoice && (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <button type="button" onClick={() => setDirectionMode("explore")} data-selected={directionMode === "explore" ? "true" : "false"} className="brand-choice rounded-[15px] border border-transparent bg-white p-3 text-left transition">
                      <div className="flex items-center gap-3"><span className="brand-choice-mark flex h-9 w-9 items-center justify-center rounded-[11px] bg-violet-100 text-violet-700"><Palette size={17} /></span><div><p className="text-sm font-black text-slate-950">Explore new directions</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">Compare three creative routes.</p></div></div>
                    </button>
                    <button type="button" onClick={() => setDirectionMode("keep-current")} data-selected={directionMode === "keep-current" ? "true" : "false"} className="brand-choice rounded-[15px] border border-transparent bg-white p-3 text-left transition">
                      <div className="flex items-center gap-3"><span className="brand-choice-mark flex h-9 w-9 items-center justify-center rounded-[11px] bg-slate-100 text-slate-600"><BadgeCheck size={17} /></span><div><p className="text-sm font-black text-slate-950">Keep the current direction</p><p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">Focus only on the requested items.</p></div></div>
                    </button>
                  </div>
                </div>
              )}
            </Panel>

            {selectedApplications.length > 0 && (
              <Panel eyebrow={`${applicationStepNumber} · Application Details`} title={selectedApplications.length === 1 ? `Tell us what goes on the ${selectedApplications[0].label}` : "Add the content for each selected application"} description="These details stay attached to the exact item. They do not create a full rebrand or unrelated guideline project.">
                <div className="grid gap-5">
                  {selectedApplications.map((application) => (
                    <section key={application.id} className="rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 sm:p-5">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#a13df0]">{application.category}</p>
                        <h3 className="mt-1 text-xl font-black text-[var(--text-primary)]">{application.label}</h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{application.description}</p>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {(BRAND_APPLICATION_FIELDS[application.id] || []).map((field) => (
                          <Field key={field.id} label={`${field.label}${field.required ? " *" : ""}`}>
                            {field.multiline ? (
                              <textarea
                                value={applicationBriefs[application.id]?.[field.id] || ""}
                                onChange={(event) => updateApplicationBrief(application.id, field.id, event.target.value)}
                                placeholder={field.placeholder}
                                className="brand-input min-h-[96px] resize-y"
                              />
                            ) : (
                              <input
                                value={applicationBriefs[application.id]?.[field.id] || ""}
                                onChange={(event) => updateApplicationBrief(application.id, field.id, event.target.value)}
                                placeholder={field.placeholder}
                                className="brand-input"
                              />
                            )}
                          </Field>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </Panel>
            )}

            {error && <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

            <div className="flex flex-col gap-4 rounded-[26px] border border-violet-200 bg-white p-5 shadow-[0_16px_40px_rgba(70,35,103,.08)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Ready</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Create only the workspace this project needs</h2>
                <p className="mt-1 text-sm text-slate-500">Text strategy is created first. Images are generated later only when requested.</p>
              </div>
              <button type="button" onClick={handleBuildBrand} disabled={isGenerating} className="min-h-12 rounded-full bg-violet-700 px-6 text-sm font-black text-white shadow-lg shadow-violet-700/20 transition hover:-translate-y-0.5 hover:bg-violet-800 disabled:cursor-wait disabled:opacity-50">
                {isGenerating ? "Creating Workspace…" : `${selectedApplications.length === 1 ? `Create ${selectedApplications[0].label} Workspace` : "Create Brand Workspace"}${shouldGenerateBrandBlueprint(draftJourney) ? ` · ${CREDIT_COSTS.brandSystemText} credits` : ""}`}
              </button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-28 xl:self-start">
            <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_20px_50px_rgba(63,30,94,.1)]">
              <header className="bg-gradient-to-br from-violet-700 to-fuchsia-600 p-5 text-white">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">Your selected journey</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">{journey.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/80">{journey.helper}</p>
              </header>
              <div className="p-5">
                <div className="grid gap-2">
                  <SummaryRow label="Creative direction" value={draftJourney.includeCreativeDirections ? "3 text directions first" : "Not included"} />
                  <SummaryRow label="Logo" value={LOGO_DECISIONS.find((item) => item.id === logoAction)?.label || "No logo work"} />
                  <SummaryRow label="Selected items" value={`${dynamicSummary.length} item${dynamicSummary.length === 1 ? "" : "s"}`} />
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Workspace includes</p>
                  <div className="mt-3 grid gap-2">
                    {workspaceSummary.length ? workspaceSummary.map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-[13px] bg-slate-50 px-3 py-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-violet-100 text-[10px] font-black text-violet-700">✓</span>
                        <span className="text-xs font-bold text-slate-700">{item}</span>
                      </div>
                    )) : <p className="text-xs leading-5 text-slate-500">Add the exact custom scope to prepare the project journey.</p>}
                  </div>
                </div>

                <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-amber-700">Transparent workflow</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">AI creates strategy and concept previews. Final vector, editable and print-ready assets remain available through Heyy Studio Experts.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </PageContainer>

      <AnimatePresence>
        {isGenerating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-5 backdrop-blur-md">
            <motion.div initial={{ y: 18, scale: .97 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-lg overflow-hidden rounded-[28px] border border-violet-300 bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-violet-700 to-fuchsia-500 text-xl font-black text-white">h</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">Brand Studio is preparing</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{activeLoadingSteps[loadingStep]}</h3>
                </div>
              </div>
              <div className="mt-5 overflow-hidden rounded-full bg-violet-100 p-1">
                <div className="h-2 w-[36%] rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500" style={{ animation: "brandLoaderMove 1.15s ease-in-out infinite" }} />
              </div>
              <div className="mt-5 grid gap-2">
                {activeLoadingSteps.map((step, index) => (
                  <div key={step} className={`flex items-center gap-3 rounded-[13px] border px-3 py-2.5 ${index <= loadingStep ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-slate-50"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-[8px] text-[10px] font-black ${index < loadingStep ? "bg-emerald-500 text-white" : index === loadingStep ? "bg-violet-700 text-white" : "bg-slate-200 text-slate-500"}`}>{index < loadingStep ? "✓" : index + 1}</span>
                    <span className={`text-xs font-bold ${index <= loadingStep ? "text-slate-800" : "text-slate-400"}`}>{step}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );

  return (
    <StudioAccessGate path="/brand-studio">
      <SiteHeader />
      {checkingAuth ? (
        <main className="heyy-page flex min-h-screen items-center justify-center text-[var(--text-secondary)]">Checking your workspace…</main>
      ) : (
        <WorkspaceShell>{content}<SiteFooter /></WorkspaceShell>
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </StudioAccessGate>
  );
}

function Panel({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--glass)] p-5 shadow-[var(--shadow-card)] backdrop-blur-2xl sm:p-6">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#a13df0]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">{label}</label>
      <div className="mt-2">{children}</div>
      <style>{`.brand-input { width:100%; border:1px solid var(--border-strong); border-radius:16px; background:var(--surface-strong); padding:13px 14px; color:var(--text-primary); font-size:14px; outline:none; transition:border-color .18s ease, box-shadow .18s ease, background .18s ease; } .brand-input::placeholder { color:var(--text-muted); } .brand-input:focus { border-color:#a13df0; box-shadow:0 0 0 4px rgba(159,44,224,.13); }`}</style>
    </div>
  );
}

function ChoicePills({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item} type="button" onClick={() => onSelect(item)} data-selected={selected === item ? "true" : "false"} className="brand-compact-choice min-h-10 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-xs font-black text-[var(--text-secondary)] transition hover:border-[#a13df0] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]">
          <span>{item}</span>
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[13px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
      <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[var(--text-muted)]">{label}</span>
      <span className="max-w-[180px] text-right text-xs font-black text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
