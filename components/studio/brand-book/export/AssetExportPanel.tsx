"use client";

import { useMemo } from "react";
import { useAssets } from "@/hooks/use-assets";

function readPayload(asset: any) {
  const payload = asset?.output_payload;
  if (!payload) return {};

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  return payload;
}

function collectReadyFiles(assets: any[]) {
  const files: Array<{ name: string; url: string; type: string }> = [];

  assets.forEach((asset: any) => {
    const payload = readPayload(asset);

    const add = (name: string, url?: string, type = "file") => {
      if (!url) return;
      if (files.some((file) => file.url === url)) return;
      files.push({ name, url, type });
    };

    add(asset.title || "Saved Asset", asset.file_url, asset.asset_type || "file");
    add(asset.title || "Saved Asset", asset.thumbnail_url, asset.asset_type || "image");

    payload.logos?.forEach((item: any, index: number) =>
      add(`Logo ${index + 1}`, item.imageUrl, "logo"),
    );

    payload.moodboards?.forEach((item: any, index: number) =>
      add(`Moodboard ${index + 1}`, item.imageUrl, "moodboard"),
    );

    payload.variations?.forEach((item: any, index: number) =>
      add(`Variation ${index + 1}`, item.imageUrl, "variation"),
    );
  });

  return files.slice(0, 8);
}

export default function AssetExportPanel() {
  const { assets } = useAssets();
  const readyFiles = useMemo(() => collectReadyFiles(assets), [assets]);

  return (
    <section className="heyy-deliverables overflow-hidden rounded-[25px] border border-blue-200 bg-white shadow-[0_14px_34px_rgba(30,80,145,.06)]">
      <style>{`
        .heyy-deliverables-icon {
          display: flex !important;
          width: 48px !important;
          height: 48px !important;
          flex: 0 0 48px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 15px !important;
          background: #1766c2 !important;
          color: #fff !important;
          box-shadow: 0 11px 23px rgba(23,102,194,.22) !important;
        }

        .heyy-deliverables-icon svg {
          stroke: #fff !important;
        }

        .heyy-ready-file {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 14px !important;
          border: 1px solid #dbe3ed !important;
          border-radius: 17px !important;
          background: #f8fafc !important;
          padding: 15px !important;
          color: #17151f !important;
          transition: all 180ms ease !important;
        }

        .heyy-ready-file:hover {
          transform: translateY(-2px);
          border-color: #6c00ff !important;
          background: #f3ebff !important;
          box-shadow: 0 10px 22px rgba(108,0,255,.10) !important;
        }
      `}</style>

      <header className="flex items-center gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 sm:p-6">
        <span className="heyy-deliverables-icon">
          <PackageIcon />
        </span>

        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.19em] text-blue-700">
            Deliverables
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-slate-950">
            Ready project files
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Open or download the saved files currently available in this project.
          </p>
        </div>
      </header>

      <div className="p-5 sm:p-6">
        {readyFiles.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {readyFiles.map((file) => (
              <a
                key={file.url}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                download
                className="heyy-ready-file"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-blue-700 shadow-sm">
                    <FileIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{file.name}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-slate-400">
                      {file.type}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-blue-600 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white">
                  Download
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-blue-300 bg-blue-50 p-8 text-center">
            <p className="font-black text-blue-800">No downloadable files yet.</p>
            <p className="mt-2 text-sm text-slate-500">
              Saved logo, moodboard and production files will appear here when available.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function PackageIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}
