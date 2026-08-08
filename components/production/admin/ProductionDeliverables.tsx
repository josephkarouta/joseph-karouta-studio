"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ProductionDeliverablesProps = {
  job: any;
  onUploaded: () => void;
};

type DeliverableGroup = {
  name: string;
  versions: any[];
  latest: any;
  final: any | null;
};

export default function ProductionDeliverables({
  job,
  onUploaded,
}: ProductionDeliverablesProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [deliverables, setDeliverables] = useState<any[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [finalizingId, setFinalizingId] = useState<
    string | null
  >(null);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState("");

  async function loadDeliverables(silent = false) {
    if (!silent) setLoading(true);

    try {
      const response = await fetch(
        `/api/admin/production-deliverables?jobId=${encodeURIComponent(
          job.id
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not load deliverables"
        );
      }

      setDeliverables(data.deliverables || []);
    } catch (error) {
      console.error("Deliverables load error:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadDeliverables();
  }, [job.id]);

  const groups = useMemo<DeliverableGroup[]>(() => {
    const grouped = new Map<string, any[]>();

    for (const file of deliverables) {
      const name =
        file.original_filename || file.filename;

      const current = grouped.get(name) || [];
      current.push(file);
      grouped.set(name, current);
    }

    return Array.from(grouped.entries())
      .map(([name, versions]) => {
        const sorted = [...versions].sort(
          (a, b) =>
            Number(b.version || 1) -
            Number(a.version || 1)
        );

        return {
          name,
          versions: sorted,
          latest:
            sorted.find((file) => file.is_latest) ||
            sorted[0],
          final:
            sorted.find((file) => file.is_final) ||
            null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deliverables]);

  const finalFiles = groups
    .map((group) => group.final)
    .filter(Boolean);

  const unpublishedFinalFiles = finalFiles.filter(
    (file: any) => !file.client_visible
  );

  const publishedFileCount = deliverables.filter(
    (file) => file.client_visible
  ).length;

  async function uploadFiles(files: File[]) {
    if (!files.length || uploading || deletingId) return;

    setUploading(true);
    setUploadNotice("");

    try {
      for (
        let index = 0;
        index < files.length;
        index += 1
      ) {
        const file = files[index];

        setUploadProgress(
          files.length === 1
            ? `Uploading ${file.name}…`
            : `Uploading ${index + 1} of ${
                files.length
              }: ${file.name}`
        );

        const formData = new FormData();

        formData.append("file", file);
        formData.append("jobId", job.id);

        const response = await fetch(
          "/api/admin/upload-production-file",
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || `Upload failed: ${file.name}`
          );
        }

        if (data.deliverable) {
          setDeliverables((current) => {
            const withoutDuplicate = current.filter(
              (item) => item.id !== data.deliverable.id,
            );
            return [data.deliverable, ...withoutDuplicate];
          });
        }
      }

      await loadDeliverables(true);
      setUploadNotice(
        files.length === 1
          ? `${files[0].name} uploaded successfully.`
          : `${files.length} files uploaded successfully.`,
      );
      void Promise.resolve(onUploaded());
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Upload failed"
      );
    } finally {
      setUploading(false);
      setUploadProgress("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function downloadFile(path: string) {
    try {
      const response = await fetch(
        "/api/admin/download-production-file",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          "Could not create download link"
        );
      }

      window.open(data.url, "_blank");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not download file"
      );
    }
  }

  async function markFinal(file: any) {
    setFinalizingId(file.id);

    try {
      const response = await fetch(
        "/api/admin/production-deliverables",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliverableId: file.id,
            jobId: job.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not mark file as final"
        );
      }

      await loadDeliverables(true);
      await onUploaded();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not mark file as final"
      );
    } finally {
      setFinalizingId(null);
    }
  }

  async function deleteDeliverable(file: any) {
    if (file.client_visible || deletingId) return;

    const filename =
      file.original_filename ||
      file.filename ||
      "this file";

    const confirmed = window.confirm(
      `Delete ${filename} — Version ${file.version || 1}?`
    );

    if (!confirmed) return;

    setDeletingId(file.id);

    try {
      const response = await fetch(
        "/api/admin/production-deliverables",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deliverableId: file.id,
            jobId: job.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not delete file"
        );
      }

      await loadDeliverables(true);
      await onUploaded();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not delete file"
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function deliverFinalFiles() {
    setPublishing(true);

    try {
      const response = await fetch(
        "/api/admin/update-production-job",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: job.id,
            status: "Client Reviewing",
            priority: job.priority,
            assigned_studio: job.assigned_studio,
            internal_notes: job.internal_notes,
            delivery_status: "Awaiting Client Approval",
            publish_final_deliverables: true,
            delivery_message: deliveryMessage.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Could not deliver final files"
        );
      }

      setDeliveryMessage("");
      await loadDeliverables(true);
      await onUploaded();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not deliver final files"
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="heyy-deliverables-manager">
      <style>{`
        .heyy-deliverables-manager,
        .heyy-deliverables-manager * { box-sizing: border-box; }

        .heyy-delivery-summary {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 10px;
        }

        .heyy-delivery-stat {
          border: 1px solid #bdebd2;
          border-radius: 15px;
          background: rgba(255,255,255,.82);
          padding: 12px;
        }

        .heyy-delivery-upload {
          display: flex;
          min-height: 104px;
          cursor: pointer;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 14px;
          border: 1px solid #078348;
          border-radius: 18px;
          background: linear-gradient(135deg,#078348 0%,#0ea85b 52%,#19b89f 100%);
          color: #fff;
          padding: 18px 20px;
          box-shadow: 0 16px 32px rgba(7,131,72,.22);
          transition: all 180ms ease;
        }

        .heyy-delivery-upload:hover {
          transform: translateY(-2px);
          border-color: #065f46;
          background: linear-gradient(135deg,#066b3d 0%,#0b9952 52%,#0f9f89 100%);
          box-shadow: 0 20px 38px rgba(7,131,72,.28);
        }

        .heyy-delivery-upload-title {
          color: #fff !important;
        }

        .heyy-delivery-upload-copy {
          color: rgba(255,255,255,.82) !important;
        }

        .heyy-delivery-upload-types {
          border: 1px solid rgba(255,255,255,.42) !important;
          background: rgba(255,255,255,.16) !important;
          color: #fff !important;
          backdrop-filter: blur(10px);
        }

        .heyy-delivery-upload-icon {
          display: flex;
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          background: #fff;
          color: #078348;
          box-shadow: 0 10px 22px rgba(0,56,31,.22);
        }

        .heyy-delivery-upload-icon svg {
          width: 23px;
          height: 23px;
        }

        .heyy-delivery-note {
          margin-top: 14px;
          border: 1px solid #cfe8da;
          border-radius: 18px;
          background: linear-gradient(135deg,#f6fffa 0%,#ffffff 82%);
          padding: 16px;
          box-shadow: 0 9px 22px rgba(23,93,56,.045);
        }

        .heyy-delivery-note textarea {
          width: 100%;
          min-height: 92px;
          margin-top: 10px;
          resize: vertical;
          border: 1px solid #b9dcc8 !important;
          border-radius: 14px !important;
          background: #ffffff !important;
          color: #17211b !important;
          padding: 13px 14px !important;
          font-size: 13px !important;
          line-height: 1.65 !important;
          outline: none !important;
          transition: all 180ms ease !important;
        }

        .heyy-delivery-note textarea::placeholder {
          color: #8a9690 !important;
        }

        .heyy-delivery-note textarea:focus {
          border-color: #0b8f4d !important;
          box-shadow: 0 0 0 4px rgba(11,143,77,.10) !important;
        }

        .heyy-delivery-group {
          overflow: hidden;
          border: 1px solid #cfe8da;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 9px 22px rgba(23,93,56,.045);
        }

        .heyy-delivery-group[data-has-final="true"] {
          border-color: #34c77b;
          box-shadow: 0 14px 30px rgba(15,145,78,.13);
        }

        .heyy-delivery-group-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          border-bottom: 1px solid #dcefe4;
          background: linear-gradient(135deg,#effcf4 0%,#ffffff 75%);
          padding: 14px 16px;
        }

        .heyy-file-type-icon {
          display: inline-flex;
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          border: 1px solid currentColor;
          border-radius: 14px;
          font-weight: 900;
          line-height: 1;
          box-shadow: 0 7px 16px rgba(31,41,55,.08);
        }

        .heyy-file-type-icon svg {
          width: 18px;
          height: 18px;
        }

        .heyy-file-type-icon small {
          font-size: 8px;
          letter-spacing: .04em;
        }

        .heyy-version-row {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          padding: 14px 16px;
        }

        .heyy-version-row + .heyy-version-row {
          border-top: 1px solid #edf2ef;
        }

        .heyy-version-row[data-final="true"] {
          background: linear-gradient(135deg,#d9ffe8 0%,#f2fff7 72%);
          box-shadow: inset 6px 0 0 #12a55c;
        }

        .heyy-version-row[data-final="true"]::before {
          content: "SELECTED FINAL";
          position: absolute;
          top: 9px;
          right: 12px;
          border-radius: 999px;
          background: #0b8f4d;
          color: #fff;
          padding: 4px 8px;
          font-size: 7px;
          font-weight: 900;
          letter-spacing: .14em;
        }

        .heyy-version-row[data-final="true"] .heyy-version-actions {
          padding-top: 18px;
        }

        .heyy-version-row[data-latest="true"]:not([data-final="true"]) {
          background: #faf7ff;
        }

        .heyy-final-badge {
          background: #0b8f4d !important;
          color: #fff !important;
          box-shadow: 0 7px 16px rgba(11,143,77,.2);
        }

        .heyy-delivered-badge {
          background: #0f766e !important;
          color: #fff !important;
        }

        .heyy-latest-badge {
          background: #6c00ff !important;
          color: #fff !important;
        }

        .heyy-version-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .heyy-version-button {
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          transition: all 180ms ease;
        }

        .heyy-version-button:hover { transform: translateY(-1px); }

        .heyy-version-button[data-tone="download"] {
          border: 1px solid #d8dce0;
          background: #fff;
          color: #17151f;
        }

        .heyy-version-button[data-tone="final"] {
          border: 1px solid #6c00ff;
          background: linear-gradient(135deg,#5b00d6,#7c18ff);
          color: #fff;
          box-shadow: 0 8px 18px rgba(108,0,255,.22);
        }

        .heyy-version-button[data-tone="final"]:hover {
          background: linear-gradient(135deg,#4700a8,#6810df);
          box-shadow: 0 11px 22px rgba(108,0,255,.28);
        }

        .heyy-version-history {
          border-top: 1px solid #dcefe4;
          background: #fafcfb;
        }

        .heyy-delivery-action {
          margin-top: 16px;
          border: 1px solid #a8e2c0;
          border-radius: 18px;
          background: linear-gradient(135deg,#e7fff0 0%,#ffffff 100%);
          padding: 16px;
        }

        .heyy-delivery-action[data-state="ready"] {
          border-color: #087f48;
          background: linear-gradient(135deg,#087f48 0%,#10a45b 100%);
          color: #fff;
          box-shadow: 0 15px 30px rgba(8,127,72,.2);
        }

        .heyy-delivery-action[data-state="ready"] p {
          color: #fff !important;
        }

        .heyy-delivery-action[data-state="ready"] p + p {
          color: rgba(255,255,255,.78) !important;
        }

        @media (max-width: 640px) {
          .heyy-delivery-summary { grid-template-columns: minmax(0,1fr); }
          .heyy-delivery-upload {
            align-items: flex-start;
            flex-direction: column;
          }
          .heyy-version-actions { width: 100%; }
        }
      `}</style>

      <div className="heyy-delivery-summary">
        <DeliveryStat label="File Groups" value={groups.length} />
        <DeliveryStat label="Final Selected" value={finalFiles.length} />
        <DeliveryStat label="Published Versions" value={publishedFileCount} />
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void uploadFiles(Array.from(event.dataTransfer.files || []));
        }}
        onClick={() => {
          if (!uploading) {
            fileInputRef.current?.click();
          }
        }}
        className={`heyy-delivery-upload ${
          dragActive ? "border-emerald-600 bg-emerald-100" : ""
        } ${uploading ? "cursor-wait opacity-70" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(event) => {
            void uploadFiles(Array.from(event.currentTarget.files || []));
          }}
        />

        <div className="flex items-center gap-4">
          <span className="heyy-delivery-upload-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 18a4 4 0 0 1-.7-7.94A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 8.97" />
              <path d="M12 16V8M8.8 11.2 12 8l3.2 3.2" />
            </svg>
          </span>
          <div>
            <p className="heyy-delivery-upload-title text-sm font-black">
              {uploading
                ? uploadProgress || "Uploading..."
                : "Upload production files"}
            </p>
            <p className="heyy-delivery-upload-copy mt-1 text-xs">
              Drop files here or click to browse. Files stay private until delivered.
            </p>
          </div>
        </div>

        <span className="heyy-delivery-upload-types rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]">
          AI · SVG · PDF · EPS · PNG · JPG · ZIP
        </span>
      </div>

      {uploadNotice && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <span>{uploadNotice}</span>
          <button
            type="button"
            onClick={() => setUploadNotice("")}
            className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="rounded-2xl bg-emerald-50 p-6 text-sm text-slate-500">
            Loading deliverables...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center">
            <p className="text-sm font-black text-emerald-700">
              No final production files yet
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Upload the first editable or production-ready file above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const featured = [group.latest, group.final]
                .filter(Boolean)
                .filter(
                  (file, index, items) =>
                    items.findIndex((item) => item.id === file.id) === index,
                );

              const history = group.versions.filter(
                (file) => !featured.some((item) => item.id === file.id),
              );

              return (
                <section
                  key={group.name}
                  className="heyy-delivery-group"
                  data-has-final={group.final ? "true" : "false"}
                >
                  <div className="heyy-delivery-group-head">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileTypeIcon filename={group.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {group.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.versions.length} version
                          {group.versions.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <GroupStatus finalFile={group.final} />
                  </div>

                  <div>
                    {featured.map((file) => (
                      <VersionRow
                        key={file.id}
                        file={file}
                        deletingId={deletingId}
                        finalizingId={finalizingId}
                        onDownload={downloadFile}
                        onMarkFinal={markFinal}
                        onDelete={deleteDeliverable}
                      />
                    ))}
                  </div>

                  {history.length > 0 && (
                    <details className="heyy-version-history">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                        <div>
                          <p className="text-xs font-black text-slate-700">
                            Previous versions
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {history.length} older file version
                            {history.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-500">
                          View ↓
                        </span>
                      </summary>

                      <div className="border-t border-slate-200">
                        {history.map((file) => (
                          <VersionRow
                            key={file.id}
                            file={file}
                            deletingId={deletingId}
                            finalizingId={finalizingId}
                            onDownload={downloadFile}
                            onMarkFinal={markFinal}
                            onDelete={deleteDeliverable}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {unpublishedFinalFiles.length > 0 && (
        <div className="heyy-delivery-note">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.17em] text-emerald-700">
                Message to client
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Add a short handoff note, instructions or anything the client should know about these files.
              </p>
            </div>

            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-emerald-700">
              Optional
            </span>
          </div>

          <textarea
            value={deliveryMessage}
            onChange={(event) => setDeliveryMessage(event.target.value)}
            placeholder="Example: We’ve completed the packaging artwork and included the print-ready PDF and editable source file. Please review the final files below."
            maxLength={1200}
          />

          <div className="mt-2 flex justify-end">
            <span className="text-[9px] font-bold text-slate-400">
              {deliveryMessage.length}/1200
            </span>
          </div>
        </div>
      )}

      <div
        className="heyy-delivery-action"
        data-state={
          unpublishedFinalFiles.length > 0
            ? "ready"
            : finalFiles.length === 0
              ? "empty"
              : "delivered"
        }
      >
        {unpublishedFinalFiles.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-emerald-800">
                Final files are ready for client delivery
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {unpublishedFinalFiles.length} selected final file
                {unpublishedFinalFiles.length === 1 ? "" : "s"} will be published.
              </p>
            </div>

            <button
              type="button"
              onClick={deliverFinalFiles}
              disabled={publishing || Boolean(deletingId)}
              className="rounded-full border border-emerald-600 bg-emerald-600 px-5 py-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-40"
            >
              {publishing ? "Delivering..." : "Deliver to Client →"}
            </button>
          </div>
        ) : finalFiles.length === 0 ? (
          <div>
            <p className="text-sm font-black text-slate-700">
              No final file selected
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Choose Mark Final on the version that should be delivered.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-black text-emerald-700">
              All selected final files are delivered ✓
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Upload a new version or select a different final to send another delivery.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="heyy-delivery-stat">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function GroupStatus({ finalFile }: { finalFile: any | null }) {
  if (!finalFile) {
    return (
      <span
        className="rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]"
        style={{
          border: "1px solid #d8dce0",
          background: "#ffffff",
          color: "#64748b",
        }}
      >
        Final not selected
      </span>
    );
  }

  return (
    <span
      className="rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]"
      style={{
        border: finalFile.client_visible
          ? "1px solid #0f766e"
          : "1px solid #0b8f4d",
        background: finalFile.client_visible
          ? "#0f766e"
          : "#0b8f4d",
        color: "#ffffff",
        boxShadow: finalFile.client_visible
          ? "0 8px 18px rgba(15,118,110,.2)"
          : "0 8px 18px rgba(11,143,77,.22)",
      }}
    >
      {finalFile.client_visible
        ? `✓ Delivered V${finalFile.version || 1}`
        : `★ Final V${finalFile.version || 1} · Ready`}
    </span>
  );
}

function VersionRow({
  file,
  deletingId,
  finalizingId,
  onDownload,
  onMarkFinal,
  onDelete,
}: {
  file: any;
  deletingId: string | null;
  finalizingId: string | null;
  onDownload: (path: string) => Promise<void>;
  onMarkFinal: (file: any) => Promise<void>;
  onDelete: (file: any) => Promise<void>;
}) {
  return (
    <div
      className="heyy-version-row"
      data-final={file.is_final ? "true" : "false"}
      data-latest={file.is_latest ? "true" : "false"}
      data-delivered={file.client_visible ? "true" : "false"}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-slate-950">
            Version {file.version || 1}
          </p>

          {file.is_latest && (
            <span className="heyy-latest-badge rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]">
              Latest Upload
            </span>
          )}

          {file.is_final && (
            <span className="heyy-final-badge rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]">
              ★ Final Selected
            </span>
          )}

          {file.client_visible && (
            <span className="heyy-delivered-badge rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]">
              ✓ Delivered
            </span>
          )}
        </div>

        <p className="mt-1 text-[10px] text-slate-500">
          {file.uploaded_at
            ? new Date(file.uploaded_at).toLocaleString()
            : "Uploaded"}
          {file.file_size
            ? ` · ${(file.file_size / 1024 / 1024).toFixed(2)} MB`
            : ""}
        </p>
      </div>

      <div className="heyy-version-actions">
        <button
          type="button"
          onClick={() => onDownload(file.storage_path)}
          className="heyy-version-button"
          data-tone="download"
        >
          ↓ Download
        </button>

        {!file.is_final && (
          <button
            type="button"
            onClick={() => onMarkFinal(file)}
            disabled={
              finalizingId === file.id || deletingId === file.id
            }
            className="heyy-version-button disabled:opacity-40"
            data-tone="final"
          >
            {finalizingId === file.id ? "Saving..." : "★ Mark Final"}
          </button>
        )}

        {!file.client_visible && (
          <button
            type="button"
            onClick={() => onDelete(file)}
            disabled={
              deletingId === file.id || finalizingId === file.id
            }
            aria-label={`Delete ${
              file.original_filename || file.filename || "file"
            }`}
            title="Delete file"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-base font-black text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
          >
            {deletingId === file.id ? "…" : "×"}
          </button>
        )}
      </div>
    </div>
  );
}

type FileIconKind = "image" | "pdf" | "vector" | "archive" | "office" | "generic";

function FileTypeIcon({ filename }: { filename: string }) {
  const extension = getFileExtension(filename);
  const visual = getFileVisual(extension);

  return (
    <span
      className="heyy-file-type-icon"
      style={{
        background: visual.background,
        color: visual.foreground,
        borderColor: visual.border,
      }}
      title={`${visual.label} file`}
      aria-label={`${visual.label} file`}
    >
      <FileGlyph kind={visual.kind} />
      <small>{visual.label}</small>
    </span>
  );
}

function FileGlyph({ kind }: { kind: FileIconKind }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "image") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m5.5 17 4.2-4 3.2 3 2.4-2.2 3.2 3.2" />
      </svg>
    );
  }

  if (kind === "pdf" || kind === "office" || kind === "generic") {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v5h5M10 13h5M10 17h5" />
      </svg>
    );
  }

  if (kind === "vector") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="m7.7 7.1 3.2 8.9M16.3 7.1 13.1 16M8 6h8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 8h16v11H4z" />
      <path d="M7 4h10l2 4H5zM9 12h6" />
    </svg>
  );
}

function getFileExtension(filename: string) {
  const cleanName = String(filename || "").split("?")[0];
  const parts = cleanName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function getFileVisual(extension: string): {
  label: string;
  kind: FileIconKind;
  background: string;
  foreground: string;
  border: string;
} {
  if (["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"].includes(extension)) {
    return {
      label: extension === "jpeg" ? "JPG" : extension.toUpperCase() || "IMG",
      kind: "image",
      background: "#e0f2fe",
      foreground: "#0369a1",
      border: "#7dd3fc",
    };
  }

  if (extension === "pdf") {
    return {
      label: "PDF",
      kind: "pdf",
      background: "#fee2e2",
      foreground: "#b91c1c",
      border: "#fca5a5",
    };
  }

  if (["ai", "eps", "svg"].includes(extension)) {
    return {
      label: extension.toUpperCase(),
      kind: "vector",
      background: extension === "svg" ? "#f3e8ff" : "#ffedd5",
      foreground: extension === "svg" ? "#7e22ce" : "#c2410c",
      border: extension === "svg" ? "#d8b4fe" : "#fdba74",
    };
  }

  if (["zip", "rar", "7z"].includes(extension)) {
    return {
      label: extension.toUpperCase(),
      kind: "archive",
      background: "#e2e8f0",
      foreground: "#334155",
      border: "#94a3b8",
    };
  }

  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)) {
    return {
      label: extension.toUpperCase(),
      kind: "office",
      background: "#dbeafe",
      foreground: "#1d4ed8",
      border: "#93c5fd",
    };
  }

  return {
    label: extension.toUpperCase() || "FILE",
    kind: "generic",
    background: "#ede9fe",
    foreground: "#6d28d9",
    border: "#c4b5fd",
  };
}

