"use client";

import { useEffect, useRef, useState } from "react";
import HeyySelect from "@/components/ui/heyy-select";

type ProductionRevisionsProps = {
  job: any;
};

export default function ProductionRevisions({ job }: ProductionRevisionsProps) {
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadRevisions() {
    if (!job?.id) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/revisions/list?production_job_id=${encodeURIComponent(job.id)}`,
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load revisions");
      }

      setRevisions(data.revisions || []);
      setLoadError("");
    } catch (error) {
      console.error("Load revisions error:", error);
      setLoadError(error instanceof Error ? error.message : "Could not load revisions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevisions();
  }, [job?.id]);

  const orderedRevisions = [...revisions].sort(
    (a, b) =>
      Number(b.revision_number || 0) -
      Number(a.revision_number || 0),
  );

  const currentRevision = orderedRevisions[0] || null;
  const previousRevisions = orderedRevisions.slice(1);

  return (
    <div className="heyy-revision-manager">
      <style>{`
        .heyy-revision-manager,
        .heyy-revision-manager * { box-sizing: border-box; }

        .heyy-revision-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          border: 1px solid #ddd0f4;
          border-radius: 18px;
          background: linear-gradient(135deg,#f5edff 0%,#ffffff 72%);
          padding: 14px 16px;
        }

        .heyy-revision-card {
          overflow: hidden;
          border: 1px solid #d8c4fb;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 12px 28px rgba(108,0,255,.07);
        }

        .heyy-revision-card[data-current="true"] {
          border-color: #9d63ff;
          box-shadow: 0 15px 34px rgba(108,0,255,.12);
        }

        .heyy-revision-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          background: linear-gradient(135deg,#5b00d6 0%,#7c16ff 55%,#9a48ff 100%);
          color: #fff;
          padding: 16px 18px;
          box-shadow: inset 0 -1px 0 rgba(255,255,255,.16);
        }

        .heyy-current-pill {
          border: 1px solid #f7c948 !important;
          background: #ffd84d !important;
          color: #3a2500 !important;
          box-shadow: 0 7px 18px rgba(255,216,77,.28) !important;
        }

        .heyy-service-pill {
          border: 1px solid rgba(255,255,255,.9) !important;
          background: #ffffff !important;
          color: #5b00d6 !important;
          box-shadow: 0 7px 18px rgba(37,0,88,.18) !important;
        }

        .heyy-conversation {
          display: grid;
          gap: 16px;
          padding: 18px;
          background: linear-gradient(180deg,#fbf9ff 0%,#ffffff 100%);
        }

        .heyy-message {
          display: grid;
          grid-template-columns: 36px minmax(0,1fr);
          gap: 10px;
          max-width: 88%;
        }

        .heyy-message[data-side="studio"] {
          grid-template-columns: minmax(0,1fr) 36px;
          margin-left: auto;
        }

        .heyy-message-avatar {
          display: flex;
          width: 36px;
          height: 36px;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 900;
        }

        .heyy-message[data-side="client"] .heyy-message-avatar {
          background: #eef2f7;
          color: #475569;
        }

        .heyy-message[data-side="studio"] .heyy-message-avatar {
          background: #6c00ff;
          color: #fff;
        }

        .heyy-message-bubble {
          border-radius: 18px;
          padding: 14px 15px;
        }

        .heyy-message[data-side="client"] .heyy-message-bubble {
          border: 1px solid #dfe5ec;
          background: #f6f8fb;
        }

        .heyy-message[data-side="studio"] .heyy-message-bubble {
          border: 1px solid #d7bfff;
          background: #f2e9ff;
        }

        .heyy-revision-files {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .heyy-revision-file {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          max-width: 100%;
          border: 1px solid #d7c6ef;
          border-radius: 12px;
          background: #fff;
          padding: 9px 10px;
        }

        .heyy-file-type-icon {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border: 1px solid currentColor;
          border-radius: 10px;
          font-weight: 900;
          line-height: 1;
        }

        .heyy-file-type-icon[data-compact="true"] {
          width: 34px;
          height: 34px;
          flex-direction: column;
        }

        .heyy-file-type-icon svg {
          width: 14px;
          height: 14px;
        }

        .heyy-file-type-icon small {
          font-size: 7px;
          letter-spacing: .04em;
        }

        .heyy-revision-editor {
          margin: 0 18px 18px;
          border: 1px solid #d4b9ff;
          border-radius: 18px;
          background: linear-gradient(135deg,#f4ebff 0%,#ffffff 100%);
          padding: 16px;
        }

        .heyy-revision-upload {
          display: flex;
          min-height: 92px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          border: 1px dashed #b68cff;
          border-radius: 15px;
          background: rgba(255,255,255,.78);
          padding: 18px;
          text-align: center;
          transition: all 180ms ease;
        }

        .heyy-revision-upload:hover {
          border-color: #6c00ff;
          background: #f6efff;
        }

        .heyy-revision-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .heyy-revision-button {
          border-radius: 999px;
          padding: 10px 15px;
          font-size: 12px;
          font-weight: 900;
          transition: all 180ms ease;
        }

        .heyy-revision-button:hover { transform: translateY(-1px); }

        .heyy-revision-button[data-tone="primary"] {
          border: 1px solid #6c00ff;
          background: #6c00ff;
          color: #fff;
        }

        .heyy-revision-button[data-tone="neutral"] {
          border: 1px solid #d8d1e2;
          background: #fff;
          color: #17151f;
        }

        .heyy-revision-history {
          margin-top: 14px;
          border: 1px solid #e1d9eb;
          border-radius: 18px;
          background: #faf9fc;
          padding: 4px;
        }

        @media (max-width: 640px) {
          .heyy-message { max-width: 100%; }
          .heyy-message[data-side="studio"] { margin-left: 0; }
        }
      `}</style>

      <div className="heyy-revision-summary">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-600">
            Feedback Activity
          </p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {revisions.length} revision{revisions.length === 1 ? "" : "s"}
          </p>
        </div>

        {currentRevision && (
          <span className="rounded-full bg-violet-600 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white">
            Current: Revision #{currentRevision.revision_number}
          </span>
        )}
      </div>

      <div className="mt-4">
        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p className="font-black">Could not load revisions.</p>
            <p className="mt-1 text-xs">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadRevisions()}
              className="mt-3 rounded-full border border-rose-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em]"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <p className="rounded-2xl bg-violet-50 p-5 text-sm text-slate-500">
            Loading revisions...
          </p>
        ) : !currentRevision ? (
          <div className="rounded-[20px] border border-dashed border-violet-300 bg-violet-50 p-8 text-center">
            <p className="text-sm font-black text-violet-700">
              No client revisions yet
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Send the first proof or final files from Production Deliverables below.
              This workspace activates only after the client requests a change.
            </p>
          </div>
        ) : (
          <>
            <RevisionWorkspace
              revision={currentRevision}
              onSaved={loadRevisions}
              isCurrent
            />

            {previousRevisions.length > 0 && (
              <details className="heyy-revision-history">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[14px] px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Previous revisions
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {previousRevisions.length} completed or older conversation
                      {previousRevisions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black text-violet-700">
                    Open ↓
                  </span>
                </summary>

                <div className="space-y-4 border-t border-slate-200 p-4">
                  {previousRevisions.map((revision) => (
                    <RevisionWorkspace
                      key={revision.id}
                      revision={revision}
                      onSaved={loadRevisions}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );

}

function RevisionWorkspace({
  revision,
  onSaved,
  isCurrent = false,
}: {
  revision: any;
  onSaved: () => Promise<void>;
  isCurrent?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [response, setResponse] = useState(revision.admin_response || "");

  const [status, setStatus] = useState(revision.status || "Requested");

  const [editing, setEditing] = useState(!revision.admin_response);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingFilename, setUploadingFilename] = useState("");
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<any[]>(
    revision.workspace_revision_files || [],
  );

  useEffect(() => {
    setResponse(revision.admin_response || "");
    setStatus(revision.status || "Requested");
    setUploadedFiles(revision.workspace_revision_files || []);

    if (revision.admin_response) {
      setEditing(false);
    }
  }, [
    revision.admin_response,
    revision.status,
    revision.workspace_revision_files,
  ]);

  const canChangeFiles = status === "Requested" || status === "In Progress";

  async function uploadRevisedFile(fileToUpload: File) {
    if (!fileToUpload || uploading || !canChangeFiles) return;

    setUploading(true);
    setUploadingFilename(fileToUpload.name);
    setUploadMessage("");

    try {
      const formData = new FormData();

      formData.append("file", fileToUpload);
      formData.append("jobId", revision.production_job_id);
      formData.append("revisionId", revision.id);

      const response = await fetch("/api/admin/upload-production-file", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not upload revised file");
      }

      if (data.revisionFile) {
        setUploadedFiles((currentFiles) => [
          ...currentFiles,
          data.revisionFile,
        ]);
      }

      setUploadMessage(`${fileToUpload.name} uploaded successfully.`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not upload revised file",
      );
    } finally {
      setUploading(false);
      setUploadingFilename("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function deleteRevisionFile(revisionFile: any) {
    if (!canChangeFiles || deletingFileId) return;

    const deliverable =
      revisionFile.production_deliverables || revisionFile.deliverable;

    const filename =
      deliverable?.original_filename ||
      deliverable?.filename ||
      revisionFile.filename ||
      "this file";

    const confirmed = window.confirm(`Delete ${filename} from this revision?`);

    if (!confirmed) return;

    setDeletingFileId(revisionFile.id);
    setUploadMessage("");

    try {
      const response = await fetch("/api/admin/upload-production-file", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          revisionFileId: revisionFile.id,
          revisionId: revision.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not delete revision file");
      }

      setUploadedFiles((currentFiles) =>
        currentFiles.filter((file) => file.id !== revisionFile.id),
      );

      setUploadMessage(`${filename} deleted.`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not delete revision file",
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  async function saveDraft() {
    await saveRevision(false);
  }

  async function sendToClient() {
    if (!response.trim()) {
      alert("Write a response before sending it to the client.");
      return;
    }

    if (uploadedFiles.length === 0) {
      alert("Upload at least one revised file before sending.");
      return;
    }

    await saveRevision(true);
  }

  async function saveRevision(sendToClient: boolean) {
    if (sendToClient) {
      setSending(true);
    } else {
      setSaving(true);
    }

    try {
      const nextStatus = sendToClient ? "Waiting Approval" : status;

      const responseResult = await fetch("/api/revisions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          revision_id: revision.id,
          status: nextStatus,
          admin_response: response,
          responded_by: null,
          notify_client: sendToClient,
        }),
      });

      const data = await responseResult.json();

      if (!responseResult.ok || !data.success) {
        throw new Error(data.error || "Could not update revision");
      }

      setResponse(data.revision.admin_response || "");
      setStatus(data.revision.status || nextStatus);
      setEditing(false);

      await onSaved();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not update revision",
      );
    } finally {
      setSaving(false);
      setSending(false);
    }
  }

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.item(0) || null;

    if (selectedFile) {
      void uploadRevisedFile(selectedFile);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    if (!canChangeFiles) return;

    const droppedFile = event.dataTransfer.files?.item(0);

    if (droppedFile) {
      void uploadRevisedFile(droppedFile);
    }
  }

  return (
    <article
      className="heyy-revision-card"
      data-current={isCurrent ? "true" : "false"}
    >
      <header className="heyy-revision-card-head">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
            Revision #{revision.revision_number}
          </p>
          <h3 className="mt-1 text-lg font-black text-white">{status}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCurrent && (
            <span className="heyy-current-pill rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em]">
              Current
            </span>
          )}
          <span className="heyy-service-pill rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em]">
            {revision.service || "Production"}
          </span>
        </div>
      </header>

      <div className="heyy-conversation">
        <div className="heyy-message" data-side="client">
          <div className="heyy-message-avatar">C</div>
          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.17em] text-slate-400">
              Client Request
            </p>
            <div className="heyy-message-bubble">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {revision.message || "No message provided."}
              </p>

              {Array.isArray(revision.client_message?.attachments) &&
                revision.client_message.attachments.length > 0 && (
                  <div className="heyy-revision-files">
                    {revision.client_message.attachments.map((attachment: any) => (
                      <a
                        key={attachment.id}
                        href={attachment.download_url || undefined}
                        download={attachment.filename}
                        aria-disabled={!attachment.download_url}
                        className={`heyy-revision-file ${
                          attachment.download_url
                            ? "hover:border-violet-400"
                            : "pointer-events-none opacity-50"
                        }`}
                      >
                        <span className="heyy-file-type-icon" data-compact="true">
                          <FileGlyph kind="generic" />
                          <small>FILE</small>
                        </span>
                        <span className="min-w-0 truncate text-xs font-black text-slate-700">
                          {attachment.filename}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>

        {!editing && (
          <div className="heyy-message" data-side="studio">
            <div>
              <p className="mb-2 text-right text-[9px] font-black uppercase tracking-[0.17em] text-violet-500">
                Studio Response
              </p>
              <div className="heyy-message-bubble">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {response || "No studio response has been added."}
                </p>

                <RevisionFiles
                  files={uploadedFiles}
                  canDelete={false}
                  deletingFileId={null}
                />
              </div>
            </div>
            <div className="heyy-message-avatar">H</div>
          </div>
        )}
      </div>

      {editing ? (
        <section className="heyy-revision-editor">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600">
              Reply to Client
            </p>

            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Write your response to the client..."
              className="mt-3 min-h-[120px] w-full rounded-[15px] border border-violet-200 bg-white p-4 text-sm text-slate-950 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 placeholder:text-slate-400"
            />
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Revised Files
            </p>

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
              onDrop={handleDrop}
              onClick={() => {
                if (!uploading && canChangeFiles) {
                  fileInputRef.current?.click();
                }
              }}
              className={`heyy-revision-upload mt-3 ${
                dragActive ? "border-violet-600 bg-violet-100" : ""
              } ${uploading ? "cursor-wait opacity-70" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={uploading || !canChangeFiles}
                onChange={handleFileSelection}
              />

              {!canChangeFiles ? (
                <div>
                  <p className="text-sm font-black text-slate-600">
                    Revision files are locked
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Files cannot be changed after sending.
                  </p>
                </div>
              ) : uploading ? (
                <div>
                  <p className="text-sm font-black text-violet-700">
                    Uploading...
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {uploadingFilename}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-black text-slate-950">
                    Add revised files
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Drop one file here or click to browse
                  </p>
                </div>
              )}
            </div>

            {uploadMessage && (
              <p className="mt-3 text-xs font-bold text-emerald-600">
                {uploadMessage}
              </p>
            )}

            <RevisionFiles
              files={uploadedFiles}
              canDelete={canChangeFiles}
              deletingFileId={deletingFileId}
              onDelete={deleteRevisionFile}
            />
          </div>

          <div className="heyy-revision-actions">
            <div className="min-w-[170px]"><HeyySelect value={status} tone="admin" ariaLabel="Revision status" options={["Requested","In Progress","Waiting Approval","Approved","Declined","Cancelled"]} onChange={setStatus} triggerClassName="!min-h-10 !rounded-full !px-4 !py-2 !text-xs" /></div>

            <button
              type="button"
              onClick={saveDraft}
              disabled={
                saving || sending || uploading || Boolean(deletingFileId)
              }
              className="heyy-revision-button"
              data-tone="neutral"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={sendToClient}
              disabled={
                sending || saving || uploading || Boolean(deletingFileId)
              }
              className="heyy-revision-button"
              data-tone="primary"
            >
              {sending ? "Sending..." : "Send to Client →"}
            </button>

            {revision.admin_response && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={
                  saving || sending || uploading || Boolean(deletingFileId)
                }
                className="heyy-revision-button text-slate-500"
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 bg-white px-4 py-3">
          <p className="text-[10px] font-bold text-slate-400">
            Created{" "}
            {revision.created_at
              ? new Date(revision.created_at).toLocaleString()
              : "-"}
          </p>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="heyy-revision-button"
            data-tone="neutral"
          >
            Edit Response
          </button>
        </div>
      )}
    </article>
  );

}

function RevisionFiles({
  files,
  canDelete,
  deletingFileId,
  onDelete,
}: {
  files: any[];
  canDelete: boolean;
  deletingFileId: string | null;
  onDelete?: (revisionFile: any) => void;
}) {
  if (!files?.length) {
    return (
      <p className="mt-3 text-xs text-slate-400">
        No revised files attached.
      </p>
    );
  }

  return (
    <div className="heyy-revision-files">
      {files.map((revisionFile: any) => {
        const deliverable =
          revisionFile.production_deliverables || revisionFile.deliverable;

        const deleting = deletingFileId === revisionFile.id;
        const filename =
          deliverable?.original_filename ||
          deliverable?.filename ||
          revisionFile.filename ||
          "Revised file";

        return (
          <div
            key={revisionFile.id || revisionFile.deliverable_id}
            className="heyy-revision-file"
          >
            <FileTypeIcon filename={filename} compact />

            <div className="min-w-0">
              <p className="max-w-[230px] truncate text-xs font-black text-slate-900">
                {filename}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Version {deliverable?.version || revisionFile.version || 1}
              </p>
            </div>

            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(revisionFile)}
                disabled={deleting}
                aria-label="Delete revision file"
                title="Delete file"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-base font-black leading-none text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
              >
                {deleting ? "…" : "×"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

type FileIconKind = "image" | "pdf" | "vector" | "archive" | "office" | "generic";

function FileTypeIcon({
  filename,
  compact = false,
}: {
  filename: string;
  compact?: boolean;
}) {
  const extension = getFileExtension(filename);
  const visual = getFileVisual(extension);

  return (
    <span
      className="heyy-file-type-icon"
      data-compact={compact ? "true" : "false"}
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

