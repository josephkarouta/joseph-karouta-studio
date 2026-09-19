"use client";

import { useEffect, useMemo, useState } from "react";
import { useAssets } from "@/hooks/use-assets";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function readPayload(asset: any) {
  const payload = asset?.output_payload || {};

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  return payload;
}

function looksLikeFileUrl(value: unknown) {
  if (typeof value !== "string") return false;
  const url = value.trim();
  return Boolean(url) && (/^https?:\/\//i.test(url) || url.startsWith("/") || url.startsWith("data:"));
}

function isImageUrl(value: string) {
  const url = String(value || "").trim().toLowerCase().split("?")[0].split("#")[0];
  return url.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(url);
}

function isDocumentUrl(value: string) {
  const url = String(value || "").trim().toLowerCase().split("?")[0].split("#")[0];
  return /\.(pdf|docx?|pptx?|xlsx?|zip|ai|eps)$/i.test(url);
}

function collectAssetUrls(value: any, seen = new Set<any>()): string[] {
  if (!value || seen.has(value)) return [];
  if (typeof value === "string") return looksLikeFileUrl(value) ? [value.trim()] : [];
  if (typeof value !== "object") return [];
  seen.add(value);

  const urls: string[] = [];
  const record = value as Record<string, any>;
  for (const key of ["imageUrl", "image_url", "file_url", "thumbnail_url", "url", "previewUrl", "preview_url", "downloadUrl", "download_url"]) {
    const candidate = record[key];
    if (looksLikeFileUrl(candidate)) urls.push(String(candidate).trim());
  }

  for (const key of [
    "selectedConcept",
    "selectedDirection",
    "selectedLogo",
    "selectedMoodboardData",
    "moodboards",
    "variations",
    "logos",
    "directions",
    "conceptsByDirection",
    "concepts",
    "outputs",
    "files",
  ]) {
    const child = record[key];
    if (Array.isArray(child)) {
      for (const item of child) urls.push(...collectAssetUrls(item, seen));
    } else if (child && typeof child === "object") {
      urls.push(...collectAssetUrls(child, seen));
    }
  }
  return urls;
}

function getAssetUrls(asset: any) {
  const output = readPayload(asset);
  return Array.from(new Set([
    ...collectAssetUrls({ file_url: asset?.file_url, thumbnail_url: asset?.thumbnail_url }),
    ...collectAssetUrls(output),
  ].filter(Boolean)));
}

function getAssetImages(asset: any) {
  return getAssetUrls(asset).filter(isImageUrl);
}

function getAssetDocuments(asset: any) {
  return getAssetUrls(asset).filter(isDocumentUrl);
}

function getPreviewUrl(asset: any) {
  return getAssetImages(asset)[0] || null;
}

function getAssetCount(asset: any) {
  const files = getAssetUrls(asset);
  return Math.max(1, files.length);
}

function isUsefulVisibleAsset(asset: any) {
  if (!asset || asset.asset_type === "brand_application_approval") return false;
  const urls = getAssetUrls(asset);
  if (urls.some((url) => isImageUrl(url) || isDocumentUrl(url))) return true;

  // Selection/state records are useful to workflows but are not useful files
  // for the user-facing Asset Library when they contain no visual/file.
  const type = String(asset.asset_type || "").toLowerCase();
  if (type.includes("selected") || type.endsWith("_selection")) return false;
  if (type === "brand_guidelines") return false;
  return false;
}

function typeLabel(type?: string) {
  return String(type || "asset")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StudioAssets() {
  const { assets } = useAssets();

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [activeAsset, setActiveAsset] = useState<any>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const filters = [
    { id: "all", label: "All" },
    { id: "moodboard", label: "Moodboards" },
    { id: "logo", label: "Logos" },
    { id: "brand_guidelines", label: "Guidelines" },
  ];

  const displayAssets = useMemo(
    () => assets.filter((asset: any) => isUsefulVisibleAsset(asset)),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    if (filter === "all") return displayAssets;

    if (filter === "logo") {
      return displayAssets.filter((asset: any) =>
        String(asset.asset_type || "").includes("logo"),
      );
    }

    if (filter === "moodboard") {
      return displayAssets.filter((asset: any) =>
        String(asset.asset_type || "").includes("moodboard"),
      );
    }

    return displayAssets.filter((asset: any) => asset.asset_type === filter);
  }, [displayAssets, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / 9));
  const visibleAssets = filteredAssets.slice((page - 1) * 9, page * 9);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const activeImages = activeAsset ? getAssetImages(activeAsset) : [];
  const activeDocuments = activeAsset ? getAssetDocuments(activeAsset) : [];
  const activeImage = activeImages[activeImageIndex];

  function openAsset(asset: any) {
    setActiveAsset(asset);
    setActiveImageIndex(0);
  }

  function closeAsset() {
    setActiveAsset(null);
    setActiveImageIndex(0);
  }

  function nextImage() {
    if (activeImages.length === 0) return;
    setActiveImageIndex((index) =>
      index >= activeImages.length - 1 ? 0 : index + 1,
    );
  }

  function previousImage() {
    if (activeImages.length === 0) return;
    setActiveImageIndex((index) =>
      index <= 0 ? activeImages.length - 1 : index - 1,
    );
  }

  async function downloadActiveImage() {
    if (!activeAsset) return;
    const activeDownloadUrl = activeImage || activeDocuments[0];
    if (!activeDownloadUrl) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (error || !token) throw new Error("Your session expired. Sign in again.");

      const allUrls = getAssetUrls(activeAsset);
      const downloadIndex = Math.max(0, allUrls.indexOf(activeDownloadUrl));
      const response = await fetch(
        `/api/assets/download?assetId=${encodeURIComponent(activeAsset.id)}&index=${downloadIndex}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = response.ok ? null : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "The asset could not be downloaded.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ||
        `${String(activeAsset.title || "heyy-studio-asset").replace(/[^a-zA-Z0-9._-]+/g, "-")}.bin`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "The asset could not be downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  }

  if (displayAssets.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-violet-300 bg-violet-50 p-10 text-center">
        <p className="font-black text-violet-700">No assets generated yet.</p>
        <p className="mt-2 text-sm text-slate-500">
          Generated concepts, moodboards, logos and guidelines will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="heyy-assets-shell">
      <style>{`
        .heyy-assets-header-icon {
          display: flex !important;
          width: 48px !important;
          height: 48px !important;
          flex: 0 0 48px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 15px !important;
          background: linear-gradient(135deg,#8b5cf6,#8b5cf6) !important;
          color: #fff !important;
          box-shadow: 0 11px 23px rgba(139,92,246,.22) !important;
        }

        .heyy-assets-header-icon svg {
          stroke: #fff !important;
        }

        .heyy-asset-filter {
          display: inline-flex !important;
          min-height: 38px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          padding: 0 15px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          transition: all 180ms ease !important;
        }

        .heyy-asset-filter[data-active="true"] {
          border: 1px solid #8b5cf6 !important;
          background: #8b5cf6 !important;
          color: #fff !important;
          box-shadow: 0 8px 18px rgba(139,92,246,.18) !important;
        }

        .heyy-asset-filter[data-active="false"] {
          border: 1px solid #d7d0df !important;
          background: #fff !important;
          color: #5f5667 !important;
        }

        .heyy-asset-filter[data-active="false"]:hover {
          transform: translateY(-1px);
          border-color: #8b5cf6 !important;
          background: #f1e8ff !important;
          color: #8b5cf6 !important;
        }

        .heyy-assets-page-next {
          display: inline-flex !important;
          min-height: 38px !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #8b5cf6 !important;
          border-radius: 999px !important;
          background: #8b5cf6 !important;
          color: #fff !important;
          padding: 0 16px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .heyy-assets-page-next:hover:not(:disabled) {
          border-color: #8b5cf6 !important;
          background: #8b5cf6 !important;
          color: #fff !important;
        }

        .heyy-asset-download {
          display: inline-flex !important;
          min-height: 46px !important;
          width: 100% !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #8b5cf6 !important;
          border-radius: 999px !important;
          background: #8b5cf6 !important;
          color: #fff !important;
          padding: 0 16px !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          box-shadow: 0 10px 22px rgba(139,92,246,.20) !important;
        }

        .heyy-asset-download:hover {
          border-color: #8b5cf6 !important;
          background: #8b5cf6 !important;
          color: #fff !important;
        }
      `}</style>
      <section className="overflow-hidden rounded-[25px] border border-violet-200 bg-white shadow-[0_14px_34px_rgba(55,30,83,.065)]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="heyy-assets-header-icon">
              <AssetsIcon />
            </span>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.19em] text-violet-600">
                Asset Library
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                Saved outputs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Browse every generated concept, image, logo and guideline asset.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-violet-100 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
            {displayAssets.length} Assets
          </span>
        </header>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className="heyy-asset-filter"
                data-active={filter === item.id ? "true" : "false"}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAssets.map((asset: any) => {
              const previewUrl = getPreviewUrl(asset);
              const count = getAssetCount(asset);

              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => openAsset(asset)}
                  className="group min-w-0 overflow-hidden rounded-[19px] border border-slate-200 bg-white text-left transition hover:-translate-y-1 hover:border-violet-500 hover:shadow-[0_16px_32px_rgba(139,92,246,.12)]"
                >
                  <div className="relative overflow-hidden bg-slate-100">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={asset.title}
                        className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-violet-100 to-slate-100">
                        <AssetTypeIcon type={asset.asset_type} />
                      </div>
                    )}

                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-violet-700 shadow-md">
                      {typeLabel(asset.asset_type)}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-black text-slate-950">
                        {asset.title || typeLabel(asset.asset_type)}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500">
                        {count}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                      <p className="text-[10px] text-slate-400">
                        {formatDate(asset.created_at)}
                      </p>
                      <span className="text-[10px] font-black text-violet-700">
                        Preview →
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredAssets.length === 0 && (
            <div className="mt-5 rounded-[18px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-bold text-slate-500">
                No assets in this category yet.
              </p>
            </div>
          )}

          {pageCount > 1 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-xs font-bold text-slate-500">
                Page {page} of {pageCount}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-35"
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  disabled={page === pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                  className="heyy-assets-page-next disabled:opacity-35"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {activeAsset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/75 p-3 backdrop-blur-md sm:p-5">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
            <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-2xl">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white p-5 sm:p-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.19em] text-violet-600">
                    Asset Preview
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">
                    {activeAsset.title || typeLabel(activeAsset.asset_type)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {typeLabel(activeAsset.asset_type)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAsset}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-violet-500 hover:bg-violet-600 hover:text-white"
                >
                  Close
                </button>
              </header>

              <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_310px]">
                <div className="flex min-h-0 items-center justify-center overflow-hidden bg-slate-100 p-4">
                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt={activeAsset.title}
                      className="max-h-[62vh] max-w-full rounded-[18px] object-contain shadow-xl"
                    />
                  ) : activeDocuments.length ? (
                    <div className="max-w-sm text-center">
                      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-violet-100 text-violet-700">
                        <AssetTypeIcon type={activeAsset.asset_type} />
                      </span>
                      <p className="mt-4 text-base font-black text-slate-800">Downloadable project file</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">This file does not need an image preview. Use Download Asset to open the saved document.</p>
                    </div>
                  ) : null}
                </div>

                <aside className="flex min-h-0 flex-col overflow-y-auto border-t border-slate-200 p-5 lg:border-l lg:border-t-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
                    Details
                  </p>

                  <div className="mt-4 grid gap-2">
                    <Detail label="Type" value={typeLabel(activeAsset.asset_type)} />
                    <Detail label="Created" value={formatDate(activeAsset.created_at)} />
                    <Detail label="Items" value={String(getAssetCount(activeAsset))} />
                  </div>

                  {activeImages.length > 1 && (
                    <div className="mt-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Images
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {activeImages.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => setActiveImageIndex(index)}
                            className={`overflow-hidden rounded-[11px] border ${
                              activeImageIndex === index
                                ? "border-violet-600 ring-2 ring-violet-200"
                                : "border-slate-200"
                            }`}
                          >
                            <img
                              src={image}
                              alt={`Preview ${index + 1}`}
                              className="aspect-square w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={previousImage}
                          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          ← Prev
                        </button>
                        <button
                          type="button"
                          onClick={nextImage}
                          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}

                  {downloadError && (
                    <div className="mt-5 rounded-[13px] border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                      {downloadError}
                    </div>
                  )}

                  {(activeImage || activeDocuments.length > 0) && (
                    <button
                      type="button"
                      onClick={downloadActiveImage}
                      disabled={downloading}
                      className="heyy-asset-download sticky bottom-0 mt-auto pt-0 disabled:cursor-wait disabled:opacity-60"
                    >
                      {downloading ? "Preparing Download…" : "Download Asset"}
                    </button>
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-700">{value}</p>
    </div>
  );
}

function AssetsIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function AssetTypeIcon({ type }: { type?: string }) {
  const value = String(type || "");

  if (value.includes("logo")) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 8 9-8 9-8-9z" />
      </svg>
    );
  }

  if (value.includes("moodboard")) {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m5.5 17 4.2-4 3.2 3 2.4-2.2 3.2 3.2" />
      </svg>
    );
  }

  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}
