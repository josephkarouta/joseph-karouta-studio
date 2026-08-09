"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type ClientRevisionRequestProps = {
  productionJobId: string;
  userId?: string | null;
  onCreated?: () => void;
  openComposerSignal?: number;
  disabled?: boolean;
  onRevisionCountChange?: (count: number) => void;
};

type RevisionPolicy = {
  enforced: boolean;
  included: number | null;
  used: number;
  remaining: number | null;
  extraRevisionFee: number | null;
  currency: string | null;
};

const MAX_REVISION_FILES = 5;

export default function ClientRevisionRequest({
  productionJobId,
  userId: _userId,
  onCreated,
  openComposerSignal = 0,
  disabled = false,
  onRevisionCountChange,
}: ClientRevisionRequestProps) {
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revisionPolicy, setRevisionPolicy] = useState<RevisionPolicy | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previousRevisionId, setPreviousRevisionId] = useState<string | null>(
    null,
  );

  async function loadRevisions() {
    if (!productionJobId) return;

    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch(
        `/api/revisions/list?production_job_id=${encodeURIComponent(
          productionJobId,
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load revisions");
      }

      const nextRevisions = data.revisions || [];
      setRevisions(nextRevisions);
      setRevisionPolicy(data.revisionPolicy || null);
      setLoadError("");
      onRevisionCountChange?.(nextRevisions.length);
    } catch (error) {
      console.error("Load client revisions error:", error);
      setLoadError(error instanceof Error ? error.message : "Could not load revisions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRevisions();
  }, [productionJobId]);

  const latestRevision = useMemo(() => {
    if (revisions.length === 0) return null;
    return revisions[revisions.length - 1];
  }, [revisions]);

  const revisionLimitReached = Boolean(
    revisionPolicy?.enforced && Number(revisionPolicy.remaining || 0) <= 0,
  );

  useEffect(() => {
    if (openComposerSignal > 0 && !disabled && !revisionLimitReached) {
      setPreviousRevisionId(null);
      setMessage("");
      setFiles([]);
      setShowComposer(true);
    }
  }, [openComposerSignal, disabled, revisionLimitReached]);

  async function requestRevision() {
    if (!message.trim()) return;

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Your session expired. Sign in again.");
      }

      const formData = new FormData();
      formData.set("production_job_id", productionJobId);
      formData.set("message", message.trim());
      if (previousRevisionId) {
        formData.set("previous_revision_id", previousRevisionId);
      }
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/revisions/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not request revision");
      }

      setMessage("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowComposer(false);
      setPreviousRevisionId(null);

      await loadRevisions();
      onCreated?.();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not request revision",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadFile(path: string) {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Your session expired. Sign in again.");
      }

      const response = await fetch("/api/production/download-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not create download link");
      }

      const link = document.createElement("a");
      link.href = data.url;
      link.download = data.filename || "production-file";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not download file",
      );
    }
  }

  function closeComposer() {
    setShowComposer(false);
    setPreviousRevisionId(null);
    setMessage("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    setFiles((current) => {
      const combined = [...current, ...selected];
      const unique = combined.filter(
        (file, index, list) =>
          list.findIndex(
            (candidate) =>
              candidate.name === file.name &&
              candidate.size === file.size &&
              candidate.lastModified === file.lastModified,
          ) === index,
      );
      return unique.slice(0, MAX_REVISION_FILES);
    });
    event.target.value = "";
  }

  return (
    <div className="heyy-client-revisions">
      <style>{`
        .heyy-client-revisions,
        .heyy-client-revisions * {
          box-sizing: border-box;
        }

        .heyy-client-revisions {
          display: grid;
          gap: 14px;
          color: #17151f !important;
        }

        .heyy-client-revisions p,
        .heyy-client-revisions span,
        .heyy-client-revisions h3,
        .heyy-client-revisions label {
          color: inherit;
        }

        .heyy-client-revisions button {
          appearance: none !important;
          border-radius: 999px !important;
          font-family: inherit !important;
          cursor: pointer;
        }

        .heyy-revision-policy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #e6dcf7;
          border-radius: 16px;
          background: #faf7ff;
          padding: 12px 14px;
          color: #5d5268;
          font-size: 12px;
          font-weight: 750;
        }

        .heyy-revision-policy strong { color: #6d28d9; }
        .heyy-revision-policy[data-limit="true"] {
          border-color: #f1c9a2;
          background: #fff8ee;
          color: #8a4b14;
        }
        .heyy-revision-policy[data-limit="true"] strong { color: #b45309; }

        .heyy-revision-loading {
          border: 1px solid #d9c7ff !important;
          border-radius: 18px !important;
          background: linear-gradient(135deg,#f5efff,#ffffff) !important;
          padding: 18px !important;
          color: #6420d6 !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        .heyy-revision-card {
          overflow: hidden;
          border: 1px solid #d8c5ff !important;
          border-radius: 22px !important;
          background: #ffffff !important;
          box-shadow: 0 14px 30px rgba(93,36,166,.10) !important;
        }

        .heyy-revision-card-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #e7dcfb !important;
          background:
            radial-gradient(circle at 92% 10%, rgba(232,205,255,.95), transparent 34%),
            linear-gradient(135deg,#f2e9ff 0%,#ffffff 70%) !important;
          padding: 16px 18px !important;
        }

        .heyy-revision-eyebrow {
          margin: 0 !important;
          color: #6c00ff !important;
          font-size: 9px !important;
          font-weight: 950 !important;
          letter-spacing: .18em !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
        }

        .heyy-revision-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 10px;
        }

        .heyy-revision-status,
        .heyy-revision-current,
        .heyy-revision-service {
          display: inline-flex !important;
          min-height: 28px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          padding: 0 11px !important;
          font-size: 8px !important;
          font-weight: 950 !important;
          letter-spacing: .11em !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
          white-space: nowrap !important;
        }

        .heyy-revision-status[data-tone="approved"] {
          border: 1px solid #9fe4bf !important;
          background: #dff8ea !important;
          color: #087444 !important;
        }

        .heyy-revision-status[data-tone="waiting"] {
          border: 1px solid #f0cf7d !important;
          background: #fff3c7 !important;
          color: #8b5400 !important;
        }

        .heyy-revision-status[data-tone="requested"] {
          border: 1px solid #ccb4ff !important;
          background: #eee5ff !important;
          color: #5c10c5 !important;
        }

        .heyy-revision-status[data-tone="changes"] {
          border: 1px solid #f5be89 !important;
          background: #fff0df !important;
          color: #a14305 !important;
        }

        .heyy-revision-status[data-tone="neutral"] {
          border: 1px solid #d9dee8 !important;
          background: #f2f4f8 !important;
          color: #596273 !important;
        }

        .heyy-revision-current {
          background: #17151f !important;
          color: #ffffff !important;
        }

        .heyy-revision-service {
          border: 1px solid #cab1ff !important;
          background: #ffffff !important;
          color: #6313c8 !important;
        }

        .heyy-revision-card-body {
          display: grid;
          gap: 13px;
          padding: 16px !important;
        }

        .heyy-revision-block {
          border-radius: 17px !important;
          padding: 15px !important;
        }

        .heyy-revision-block[data-kind="request"] {
          border: 1px solid #dbe2ec !important;
          background: linear-gradient(135deg,#f5f7fb,#ffffff) !important;
        }

        .heyy-revision-block[data-kind="response"] {
          border: 1px solid #d8bfff !important;
          background:
            radial-gradient(circle at 100% 0%,rgba(231,205,255,.72),transparent 38%),
            linear-gradient(135deg,#f3eaff,#ffffff) !important;
        }

        .heyy-revision-block[data-kind="pending"] {
          border: 1px dashed #c8afff !important;
          background: #f7f2ff !important;
        }

        .heyy-revision-label-row {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .heyy-revision-avatar {
          display: flex !important;
          width: 31px !important;
          height: 31px !important;
          flex: 0 0 31px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 10px !important;
          font-size: 10px !important;
          font-weight: 950 !important;
        }

        .heyy-revision-avatar[data-tone="client"] {
          background: #e8edf5 !important;
          color: #495569 !important;
        }

        .heyy-revision-avatar[data-tone="studio"] {
          background: #6c00ff !important;
          color: #ffffff !important;
          box-shadow: 0 8px 18px rgba(108,0,255,.22) !important;
        }

        .heyy-revision-block-label {
          margin: 0 !important;
          color: #526076 !important;
          font-size: 8px !important;
          font-weight: 950 !important;
          letter-spacing: .17em !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
        }

        .heyy-revision-block[data-kind="response"] .heyy-revision-block-label {
          color: #6511cf !important;
        }

        .heyy-revision-message {
          margin: 11px 0 0 !important;
          color: #263247 !important;
          font-size: 13px !important;
          line-height: 1.7 !important;
          white-space: pre-wrap !important;
        }

        .heyy-revision-pending {
          margin: 0 !important;
          color: #59677b !important;
          font-size: 12px !important;
          line-height: 1.7 !important;
        }

        .heyy-revision-files {
          display: grid;
          gap: 9px;
          margin-top: 13px;
        }

        .heyy-revision-file {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid #ded3ef !important;
          border-radius: 14px !important;
          background: rgba(255,255,255,.92) !important;
          padding: 11px !important;
          box-shadow: 0 7px 16px rgba(70,41,109,.055) !important;
        }

        .heyy-revision-file-main {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
        }

        .heyy-file-icon {
          display: flex !important;
          width: 39px !important;
          height: 39px !important;
          flex: 0 0 39px !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid #8fd4ff !important;
          border-radius: 11px !important;
          background: #e7f6ff !important;
          color: #0768a6 !important;
          font-size: 7px !important;
          font-weight: 950 !important;
          line-height: 1.05 !important;
        }

        .heyy-file-icon svg {
          width: 16px !important;
          height: 16px !important;
          margin-bottom: 2px !important;
          stroke: currentColor !important;
        }

        .heyy-revision-file-name {
          overflow: hidden;
          margin: 0 !important;
          color: #17151f !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          line-height: 1.35 !important;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .heyy-revision-file-version {
          margin: 3px 0 0 !important;
          color: #748095 !important;
          font-size: 10px !important;
          font-weight: 700 !important;
        }

        .heyy-purple-action,
        .heyy-green-action,
        .heyy-secondary-action {
          display: inline-flex !important;
          min-height: 40px !important;
          align-items: center !important;
          justify-content: center !important;
          border: 0 !important;
          padding: 0 16px !important;
          font-size: 9px !important;
          font-weight: 950 !important;
          letter-spacing: .12em !important;
          text-transform: uppercase !important;
          transition: all 180ms ease !important;
        }

        .heyy-purple-action {
          background: linear-gradient(135deg,#6c00ff,#9c28ff) !important;
          color: #ffffff !important;
          box-shadow: 0 9px 20px rgba(108,0,255,.22) !important;
        }

        .heyy-purple-action:hover {
          transform: translateY(-1px);
          filter: brightness(.94);
        }

        .heyy-green-action {
          background: linear-gradient(135deg,#0b9652,#18bd76) !important;
          color: #ffffff !important;
          box-shadow: 0 9px 20px rgba(11,150,82,.20) !important;
        }

        .heyy-secondary-action {
          border: 1px solid #c8afff !important;
          background: #ffffff !important;
          color: #6413cd !important;
        }

        .heyy-revision-decision {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          border: 1px solid #efd078 !important;
          border-radius: 17px !important;
          background:
            radial-gradient(circle at 100% 0%,rgba(255,229,151,.72),transparent 42%),
            linear-gradient(135deg,#fff7da,#ffffff) !important;
          padding: 14px !important;
        }

        .heyy-revision-decision-title {
          width: 100%;
          margin: 0 !important;
          color: #754600 !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .heyy-revision-decision-copy {
          width: 100%;
          margin: -5px 0 0 !important;
          color: #8d6116 !important;
          font-size: 10px !important;
          line-height: 1.55 !important;
        }

        .heyy-revision-success {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          border: 1px solid #9edebc !important;
          border-radius: 17px !important;
          background:
            radial-gradient(circle at 100% 0%,rgba(175,244,208,.72),transparent 42%),
            linear-gradient(135deg,#e8fff2,#ffffff) !important;
          padding: 14px !important;
        }

        .heyy-revision-success-icon {
          display: flex !important;
          width: 33px !important;
          height: 33px !important;
          flex: 0 0 33px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 11px !important;
          background: #0ba25c !important;
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          box-shadow: 0 8px 18px rgba(11,162,92,.18) !important;
        }

        .heyy-revision-success-title {
          margin: 1px 0 0 !important;
          color: #075f39 !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .heyy-revision-success-copy {
          margin: 4px 0 0 !important;
          color: #267052 !important;
          font-size: 10px !important;
          line-height: 1.6 !important;
        }

        .heyy-revision-warning {
          border: 1px solid #f3bd87 !important;
          border-radius: 17px !important;
          background: #fff0df !important;
          padding: 14px !important;
        }

        .heyy-revision-warning strong {
          color: #8b3d07 !important;
          font-size: 12px !important;
        }

        .heyy-revision-warning p {
          margin: 4px 0 0 !important;
          color: #a35620 !important;
          font-size: 10px !important;
          line-height: 1.6 !important;
        }

        .heyy-revision-composer {
          overflow: hidden;
          border: 1px solid #d8c5ff !important;
          border-radius: 20px !important;
          background: #ffffff !important;
          box-shadow: 0 13px 28px rgba(93,36,166,.08) !important;
        }

        .heyy-revision-composer-head {
          border-bottom: 1px solid #e6dbf7 !important;
          background: linear-gradient(135deg,#f3ebff,#ffffff) !important;
          padding: 15px 17px !important;
        }

        .heyy-revision-composer-title {
          margin: 0 !important;
          color: #6513ce !important;
          font-size: 9px !important;
          font-weight: 950 !important;
          letter-spacing: .18em !important;
          text-transform: uppercase !important;
        }

        .heyy-revision-composer-copy {
          margin: 7px 0 0 !important;
          color: #5d687c !important;
          font-size: 11px !important;
          line-height: 1.65 !important;
        }

        .heyy-revision-composer-body {
          padding: 16px !important;
        }

        .heyy-revision-composer textarea {
          width: 100% !important;
          min-height: 112px !important;
          resize: vertical !important;
          border: 1px solid #cfd6e1 !important;
          border-radius: 15px !important;
          background: #f8f9fc !important;
          color: #17151f !important;
          padding: 13px !important;
          font-family: inherit !important;
          font-size: 12px !important;
          line-height: 1.7 !important;
          outline: none !important;
        }

        .heyy-revision-composer textarea::placeholder {
          color: #8c95a6 !important;
        }

        .heyy-revision-composer textarea:focus {
          border-color: #7b2cff !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(123,44,255,.10) !important;
        }

        .heyy-revision-composer-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 12px;
        }

        .heyy-revision-attachments {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .heyy-revision-attachment-chip {
          border: 1px solid #ddd3ec !important;
          background: #fff !important;
          color: #574e63 !important;
          padding: 8px 11px !important;
          font-size: 9px !important;
          font-weight: 800 !important;
        }

        .heyy-revision-attach-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        [data-theme="dark"] .heyy-client-revisions {
          color: #f5f2f8 !important;
        }

        [data-theme="dark"] .heyy-client-revisions :is(
          .heyy-revision-card,
          .heyy-revision-block,
          .heyy-revision-composer,
          .heyy-revision-composer-body,
          .heyy-revision-decision
        ) {
          border-color: #494052 !important;
          background: #211c28 !important;
        }

        [data-theme="dark"] .heyy-client-revisions :is(
          .heyy-revision-card-head,
          .heyy-revision-composer-head
        ) {
          border-color: #494052 !important;
          background: linear-gradient(135deg,#282130,#211c28) !important;
        }

        [data-theme="dark"] .heyy-client-revisions :is(
          .heyy-revision-message,
          .heyy-revision-composer-copy,
          .heyy-revision-pending,
          .heyy-revision-decision-copy
        ) {
          color: #c7bfce !important;
        }

        [data-theme="dark"] .heyy-revision-policy {
          border-color: #4f3c66 !important;
          background: #241a31 !important;
          color: #d7cfdf !important;
        }
        [data-theme="dark"] .heyy-revision-policy strong { color: #c4a3ff !important; }
        [data-theme="dark"] .heyy-revision-policy[data-limit="true"] {
          border-color: #7c4a25 !important;
          background: #2c1d14 !important;
          color: #f5c18e !important;
        }
        [data-theme="dark"] .heyy-revision-policy[data-limit="true"] strong { color: #fdba74 !important; }

        [data-theme="dark"] .heyy-revision-composer textarea {
          border-color: #554b60 !important;
          background: #17131d !important;
          color: #f5f2f8 !important;
        }

        [data-theme="dark"] .heyy-revision-attachment-chip {
          border-color: #554b60 !important;
          background: #17131d !important;
          color: #d7cfdf !important;
        }

        .heyy-client-revisions button:disabled {
          cursor: not-allowed !important;
          opacity: .45 !important;
          transform: none !important;
        }
      `}</style>

      {revisionPolicy?.enforced && (
        <div className="heyy-revision-policy" data-limit={revisionLimitReached ? "true" : "false"}>
          <span>
            <strong>{revisionPolicy.used} of {revisionPolicy.included}</strong> included revision{revisionPolicy.included === 1 ? "" : "s"} used
          </span>
          <span>
            {revisionLimitReached
              ? revisionPolicy.extraRevisionFee && revisionPolicy.extraRevisionFee > 0
                ? `Additional revision: ${revisionPolicy.currency || "USD"} ${revisionPolicy.extraRevisionFee}`
                : "Included revision limit reached"
              : `${revisionPolicy.remaining} remaining`}
          </span>
        </div>
      )}

      {loadError ? (
        <div className="heyy-revision-loading">
          Could not load revision history. Refresh the production workspace and try again.
        </div>
      ) : loading ? (
        <div className="heyy-revision-loading">
          Loading revision history...
        </div>
      ) : revisions.length > 0 ? (
        revisions.map((revision) => (
          <ClientRevisionCard
            key={revision.id}
            revision={revision}
            isLatest={revision.id === latestRevision?.id}
            onDownload={downloadFile}
          />
        ))
      ) : (
        !showComposer && (
          <div className="heyy-revision-loading">
            Use the “Send revision” button beside a delivered file when you want to request a change.
          </div>
        )
      )}

      {showComposer && !revisionLimitReached && (
        <section className="heyy-revision-composer">
          <div className="heyy-revision-composer-head">
            <p className="heyy-revision-composer-title">
              {previousRevisionId
                ? "Request another revision"
                : "Request a revision"}
            </p>

            <p className="heyy-revision-composer-copy">
              Explain what needs to change. The studio will review your request
              and send the revised files here.
            </p>
          </div>

          <div className="heyy-revision-composer-body">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Please make the heading larger and use a lighter background."
            />

            {files.length > 0 && (
              <div className="heyy-revision-attachments">
                {files.map((file, index) => (
                  <button
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    type="button"
                    className="heyy-revision-attachment-chip"
                    onClick={() =>
                      setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    title="Remove attachment"
                  >
                    {file.name} · {formatFileSize(file.size)} ×
                  </button>
                ))}
              </div>
            )}

            <div className="heyy-revision-composer-actions">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={selectFiles}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting || files.length >= MAX_REVISION_FILES}
                className="heyy-secondary-action heyy-revision-attach-button"
              >
                <Paperclip size={14} strokeWidth={2.2} />
                Attach files
              </button>
              <button
                type="button"
                onClick={requestRevision}
                disabled={submitting || !message.trim()}
                className="heyy-purple-action"
              >
                {submitting
                  ? "Sending..."
                  : previousRevisionId
                    ? "Send another revision"
                    : "Send revision request"}
              </button>

              <button
                type="button"
                onClick={closeComposer}
                disabled={submitting}
                className="heyy-secondary-action"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ClientRevisionCard({
  revision,
  isLatest,
  onDownload,
}: {
  revision: any;
  isLatest: boolean;
  onDownload: (path: string) => void;
}) {
  const files = revision.workspace_revision_files || [];
  const waitingApproval = revision.status === "Waiting Approval";
  const approved = revision.status === "Approved";
  const changesRequested = revision.status === "Changes Requested";
  const requested = revision.status === "Requested";

  const tone = approved
    ? "approved"
    : waitingApproval
      ? "waiting"
      : changesRequested
        ? "changes"
        : requested
          ? "requested"
          : "neutral";

  return (
    <article className="heyy-revision-card">
      <header className="heyy-revision-card-head">
        <div>
          <p className="heyy-revision-eyebrow">
            Revision #{revision.revision_number}
          </p>

          <div className="heyy-revision-pills">
            <span className="heyy-revision-status" data-tone={tone}>
              {revision.status}
            </span>

            {isLatest && (
              <span className="heyy-revision-current">Current</span>
            )}
          </div>
        </div>

        <span className="heyy-revision-service">
          {revision.service || "Production"}
        </span>
      </header>

      <div className="heyy-revision-card-body">
        <section className="heyy-revision-block" data-kind="request">
          <div className="heyy-revision-label-row">
            <span className="heyy-revision-avatar" data-tone="client">
              C
            </span>
            <p className="heyy-revision-block-label">Your request</p>
          </div>

          <p className="heyy-revision-message">
            {revision.message || "No message provided."}
          </p>

          <ClientRequestAttachments
            attachments={revision.client_message?.attachments || []}
          />
        </section>

        {revision.admin_response ? (
          <section className="heyy-revision-block" data-kind="response">
            <div className="heyy-revision-label-row">
              <span className="heyy-revision-avatar" data-tone="studio">
                H
              </span>
              <p className="heyy-revision-block-label">Studio response</p>
            </div>

            <p className="heyy-revision-message">
              {revision.admin_response}
            </p>

            <ClientRevisionFiles files={files} onDownload={onDownload} />
          </section>
        ) : (
          <section className="heyy-revision-block" data-kind="pending">
            <p className="heyy-revision-pending">
              Heyy Studio is reviewing your request. The response and revised
              files will appear here.
            </p>
          </section>
        )}

        {waitingApproval && isLatest && (
          <div className="heyy-revision-decision">
            <p className="heyy-revision-decision-title">
              Revised file ready for review
            </p>

            <p className="heyy-revision-decision-copy">
              Review the revised file in Production files. Use Send revision if it still needs changes, or Approve & complete when it is final.
            </p>
          </div>
        )}

        {approved && (
          <div className="heyy-revision-success">
            <span className="heyy-revision-success-icon">✓</span>

            <div>
              <p className="heyy-revision-success-title">
                Revision accepted
              </p>

              <p className="heyy-revision-success-copy">
                This revised file was accepted as part of the completed final delivery.
              </p>
            </div>
          </div>
        )}

        {changesRequested && (
          <div className="heyy-revision-warning">
            <strong>Additional changes requested</strong>
            <p>
              The next revision will appear here when the studio responds.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function ClientRequestAttachments({ attachments }: { attachments: any[] }) {
  if (!attachments.length) return null;

  return (
    <div className="heyy-revision-attachments">
      {attachments.map((attachment: any) => (
        <a
          key={attachment.id}
          href={attachment.download_url || undefined}
          download={attachment.filename}
          aria-disabled={!attachment.download_url}
          className={`heyy-revision-attachment-chip ${
            attachment.download_url ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <Paperclip size={12} strokeWidth={2.2} /> {attachment.filename}
        </a>
      ))}
    </div>
  );
}

function ClientRevisionFiles({
  files,
  onDownload,
}: {
  files: any[];
  onDownload: (path: string) => void;
}) {
  if (!files.length) {
    return (
      <p className="heyy-revision-pending" style={{ marginTop: 12 }}>
        No revised files were attached.
      </p>
    );
  }

  return (
    <div className="heyy-revision-files">
      {files.map((revisionFile: any) => {
        const deliverable =
          revisionFile.production_deliverables || revisionFile.deliverable;

        const storagePath =
          deliverable?.storage_path || revisionFile.storage_path;

        const filename =
          deliverable?.original_filename ||
          deliverable?.filename ||
          revisionFile.filename ||
          "Revised file";

        const extension =
          filename.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";

        return (
          <div
            key={revisionFile.id || revisionFile.deliverable_id}
            className="heyy-revision-file"
          >
            <div className="heyy-revision-file-main">
              <span className="heyy-file-icon">
                <FileIcon />
                {extension}
              </span>

              <div style={{ minWidth: 0 }}>
                <p className="heyy-revision-file-name">{filename}</p>
                <p className="heyy-revision-file-version">
                  Version {deliverable?.version || revisionFile.version || 1}
                </p>
              </div>
            </div>

            {storagePath && (
              <button
                type="button"
                onClick={() => onDownload(storagePath)}
                className="heyy-purple-action"
              >
                Download
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3h10l4 4v14H5z" />
      <path d="M15 3v5h5" />
      <path d="m8 16 2.5-3 2 2 1.5-2 2 3" />
    </svg>
  );
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
