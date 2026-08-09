"use client";

import { useState } from "react";

type ClientDeliverablesManagerProps = {
  groups: any[];
  onDownload: (path: string) => void;
  onRequestRevision: () => void;
  onApproveDelivery: () => void | Promise<void>;
  approving?: boolean;
  approved?: boolean;
  revisionLimitReached?: boolean;
};

export default function ClientDeliverablesManager({
  groups,
  onDownload,
  onRequestRevision,
  onApproveDelivery,
  approving = false,
  approved = false,
  revisionLimitReached = false,
}: ClientDeliverablesManagerProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  if (!groups?.length) {
    return (
      <div className="heyy-client-deliverables">
        <style>{deliverablesStyles}</style>
        <div className="heyy-deliverables-empty">
          <span className="heyy-deliverables-empty-icon">
            <FileIcon />
          </span>

          <div>
            <p className="heyy-deliverables-empty-title">
              No final files are available yet
            </p>
            <p className="heyy-deliverables-empty-copy">
              Approved production files will appear here when they are ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="heyy-client-deliverables">
      <style>{deliverablesStyles}</style>

      <div className="heyy-deliverables-intro">
        <div>
          <p className="heyy-deliverables-eyebrow">Production files</p>
          <p className="heyy-deliverables-copy">
            Review the latest file, request changes if needed, or approve the package once when it is final.
          </p>
        </div>

        <span className="heyy-deliverables-count">
          {groups.length} file group{groups.length === 1 ? "" : "s"}
        </span>
      </div>

      {groups.map((group: any) => {
        const finalFile = group.finalFile;

        const previousVersions = (group.versions || [])
          .filter((file: any) => file.id !== finalFile?.id)
          .sort(
            (a: any, b: any) =>
              Number(b.version || 1) - Number(a.version || 1),
          );

        const isOpen = Boolean(openGroups[group.name]);

        const finalName =
          finalFile?.original_filename ||
          finalFile?.filename ||
          group.name ||
          "Final deliverable";

        const extension =
          finalName.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";
        const isRevisionReview = finalFile?.source === "revision_review";

        return (
          <section
            key={group.name}
            className="heyy-deliverable-card"
            data-approved={approved ? "true" : "false"}
            data-review={isRevisionReview ? "true" : "false"}
          >
            <div className="heyy-deliverable-current">
              <div className="heyy-deliverable-current-main">
                <span className="heyy-deliverable-file-icon">
                  <FileIcon />
                  {extension}
                </span>

                <div style={{ minWidth: 0 }}>
                  <p className="heyy-deliverable-name">{finalName}</p>

                  <div className="heyy-deliverable-meta">
                    <span
                      className="heyy-final-badge"
                      data-review={isRevisionReview ? "true" : "false"}
                    >
                      {isRevisionReview ? "Review file" : "Final"}
                    </span>

                    <span className="heyy-version-text">
                      Version {finalFile?.version || 1}
                    </span>

                    {isRevisionReview && (
                      <span className="heyy-revision-badge">
                        Revised file ready
                      </span>
                    )}

                    {finalFile?.source === "approved_revision" && !approved && (
                      <span className="heyy-revision-badge">
                        Revised final
                      </span>
                    )}

                    {approved && (
                      <span className="heyy-complete-badge">
                        ✓ Approved & complete
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="heyy-deliverable-actions">
                <button
                  type="button"
                  onClick={() =>
                    finalFile?.storage_path &&
                    onDownload(finalFile.storage_path)
                  }
                  disabled={!finalFile?.storage_path}
                  className="heyy-download-final"
                >
                  <DownloadIcon />
                  Download
                </button>

                {!approved && (
                  <>
                    <button
                      type="button"
                      onClick={onRequestRevision}
                      disabled={approving || revisionLimitReached}
                      className="heyy-send-revision"
                      title={revisionLimitReached ? "Your included revision limit has been reached." : undefined}
                    >
                      {revisionLimitReached ? "Revision limit reached" : "Send revision"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void onApproveDelivery()}
                      disabled={approving}
                      className="heyy-approve-delivery"
                    >
                      {approving ? "Approving..." : "Approve & complete"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {previousVersions.length > 0 && (
              <div className="heyy-history-section">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.name]: !current[group.name],
                    }))
                  }
                  className="heyy-history-toggle"
                >
                  <span className="heyy-history-toggle-icon">
                    {isOpen ? "−" : "+"}
                  </span>

                  {isOpen
                    ? "Hide delivery history"
                    : `${previousVersions.length} previous version${
                        previousVersions.length === 1 ? "" : "s"
                      }`}
                </button>

                {isOpen && (
                  <div className="heyy-history-list">
                    {previousVersions.map((file: any) => {
                      const previousName =
                        file.original_filename ||
                        file.filename ||
                        "Previous deliverable";

                      return (
                        <div key={file.id} className="heyy-history-row">
                          <div className="heyy-history-file-main">
                            <span className="heyy-history-icon">
                              <FileIcon />
                            </span>

                            <div style={{ minWidth: 0 }}>
                              <p className="heyy-history-name">
                                {previousName}
                              </p>

                              <div className="heyy-history-meta">
                                <span>
                                  Version {file.version || 1}
                                </span>

                                <span>
                                  {file.published_at || file.uploaded_at
                                    ? new Date(
                                        file.published_at ||
                                          file.uploaded_at,
                                      ).toLocaleString()
                                    : "Delivered"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              file.storage_path &&
                              onDownload(file.storage_path)
                            }
                            disabled={!file.storage_path}
                            className="heyy-history-download"
                          >
                            Download
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const deliverablesStyles = `
  .heyy-client-deliverables,
  .heyy-client-deliverables * {
    box-sizing: border-box;
  }

  .heyy-client-deliverables {
    display: grid;
    gap: 14px;
    color: #17151f !important;
  }

  .heyy-client-deliverables p,
  .heyy-client-deliverables span {
    color: inherit;
  }

  .heyy-client-deliverables button {
    appearance: none !important;
    font-family: inherit !important;
    cursor: pointer;
  }

  .heyy-deliverable-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .heyy-send-revision,
  .heyy-approve-delivery {
    min-height: 42px;
    border-radius: 999px !important;
    padding: 0 15px !important;
    font-size: 10px !important;
    font-weight: 950 !important;
    transition: transform 160ms ease,box-shadow 160ms ease,background 160ms ease;
  }

  .heyy-send-revision {
    border: 1px solid #7b2cff !important;
    background: #fff !important;
    color: #6c00ff !important;
  }

  .heyy-approve-delivery {
    border: 1px solid #0d9655 !important;
    background: #0d9655 !important;
    color: #fff !important;
    box-shadow: 0 9px 20px rgba(13,150,85,.18);
  }

  .heyy-send-revision:hover:not(:disabled),
  .heyy-approve-delivery:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .heyy-client-deliverables button:disabled {
    cursor: default !important;
    opacity: .52 !important;
  }

  .heyy-deliverables-intro {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #d7c2ff !important;
    border-radius: 18px !important;
    background:
      radial-gradient(circle at 100% 0%,rgba(227,198,255,.85),transparent 37%),
      linear-gradient(135deg,#f3eaff,#ffffff) !important;
    padding: 14px 15px !important;
  }

  .heyy-deliverables-eyebrow {
    margin: 0 !important;
    color: #6b12d8 !important;
    font-size: 9px !important;
    font-weight: 950 !important;
    letter-spacing: .18em !important;
    line-height: 1 !important;
    text-transform: uppercase !important;
  }

  .heyy-deliverables-copy {
    margin: 7px 0 0 !important;
    color: #586578 !important;
    font-size: 11px !important;
    line-height: 1.6 !important;
  }

  .heyy-deliverables-count {
    display: inline-flex !important;
    min-height: 29px !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 999px !important;
    background: #17151f !important;
    color: #ffffff !important;
    padding: 0 12px !important;
    font-size: 8px !important;
    font-weight: 950 !important;
    letter-spacing: .12em !important;
    text-transform: uppercase !important;
  }

  .heyy-deliverable-card {
    overflow: hidden;
    border: 1px solid #d8c6ff !important;
    border-radius: 20px !important;
    background: #ffffff !important;
    box-shadow: 0 14px 28px rgba(108,0,255,.08) !important;
  }

  .heyy-deliverable-current {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    background:
      radial-gradient(circle at 100% 0%,rgba(230,211,255,.78),transparent 42%),
      linear-gradient(135deg,#f7f1ff 0%,#ffffff 68%) !important;
    padding: 16px !important;
  }

  .heyy-deliverable-card[data-approved="true"] {
    border-color: #7fd8aa !important;
    box-shadow: 0 16px 34px rgba(8,117,66,.14) !important;
  }

  .heyy-deliverable-card[data-approved="true"] .heyy-deliverable-current {
    background:
      radial-gradient(circle at 100% 0%,rgba(157,241,197,.92),transparent 44%),
      linear-gradient(135deg,#dcfbea 0%,#f7fffb 72%) !important;
  }

  .heyy-deliverable-current-main,
  .heyy-history-file-main {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 11px;
  }

  .heyy-deliverable-file-icon {
    display: flex !important;
    width: 46px !important;
    height: 46px !important;
    flex: 0 0 46px !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    border: 1px solid #8ed3ff !important;
    border-radius: 13px !important;
    background: #e8f7ff !important;
    color: #086ca9 !important;
    font-size: 8px !important;
    font-weight: 950 !important;
    line-height: 1.05 !important;
    box-shadow: 0 8px 18px rgba(8,108,169,.10) !important;
  }

  .heyy-deliverable-file-icon svg {
    width: 18px !important;
    height: 18px !important;
    margin-bottom: 2px !important;
    stroke: currentColor !important;
  }

  .heyy-deliverable-name {
    overflow: hidden;
    margin: 0 !important;
    color: #17151f !important;
    font-size: 14px !important;
    font-weight: 950 !important;
    line-height: 1.35 !important;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .heyy-deliverable-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    margin-top: 8px;
  }

  .heyy-final-badge,
  .heyy-revision-badge,
  .heyy-complete-badge {
    display: inline-flex !important;
    min-height: 25px !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 999px !important;
    padding: 0 9px !important;
    font-size: 7px !important;
    font-weight: 950 !important;
    letter-spacing: .11em !important;
    line-height: 1 !important;
    text-transform: uppercase !important;
  }

  .heyy-final-badge {
    background: #0a9e59 !important;
    color: #ffffff !important;
    box-shadow: 0 7px 15px rgba(10,158,89,.17) !important;
  }

  .heyy-revision-badge {
    background: #eee3ff !important;
    color: #6412ca !important;
  }

  .heyy-final-badge[data-review="true"] {
    background: #6c00ff !important;
    color: #ffffff !important;
    box-shadow: 0 7px 15px rgba(108,0,255,.18) !important;
  }

  .heyy-complete-badge {
    background: #087542 !important;
    color: #ffffff !important;
    box-shadow: 0 7px 15px rgba(8,117,66,.19) !important;
  }

  .heyy-version-text {
    color: #536274 !important;
    font-size: 10px !important;
    font-weight: 800 !important;
  }

  .heyy-download-final {
    display: inline-flex !important;
    min-height: 42px !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    border: 0 !important;
    border-radius: 999px !important;
    background: linear-gradient(135deg,#6c00ff,#9d2aff) !important;
    color: #ffffff !important;
    padding: 0 17px !important;
    font-size: 9px !important;
    font-weight: 950 !important;
    letter-spacing: .12em !important;
    text-transform: uppercase !important;
    box-shadow: 0 10px 22px rgba(108,0,255,.24) !important;
    transition: all 180ms ease !important;
  }

  .heyy-download-final svg {
    width: 16px !important;
    height: 16px !important;
    stroke: currentColor !important;
  }

  .heyy-download-final:hover {
    transform: translateY(-1px);
    filter: brightness(.94);
  }

  .heyy-history-section {
    border-top: 1px solid #e4dcf1 !important;
    background: #fcfaff !important;
    padding: 13px 15px 15px !important;
  }

  .heyy-history-toggle {
    display: inline-flex !important;
    min-height: 36px !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    border: 1px solid #cfb8ff !important;
    border-radius: 999px !important;
    background: #f1eaff !important;
    color: #6412c8 !important;
    padding: 0 13px !important;
    font-size: 9px !important;
    font-weight: 950 !important;
    transition: all 180ms ease !important;
  }

  .heyy-history-toggle:hover {
    border-color: #7a2cff !important;
    background: #e6d7ff !important;
  }

  .heyy-history-toggle-icon {
    display: flex !important;
    width: 19px !important;
    height: 19px !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 7px !important;
    background: #6c00ff !important;
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 950 !important;
  }

  .heyy-history-list {
    display: grid;
    gap: 8px;
    margin-top: 11px;
  }

  .heyy-history-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 1px solid #dce2eb !important;
    border-radius: 14px !important;
    background: #ffffff !important;
    padding: 11px !important;
    box-shadow: 0 7px 16px rgba(44,61,88,.045) !important;
  }

  .heyy-history-icon {
    display: flex !important;
    width: 34px !important;
    height: 34px !important;
    flex: 0 0 34px !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 10px !important;
    background: #edf2f8 !important;
    color: #5d6879 !important;
  }

  .heyy-history-icon svg {
    width: 17px !important;
    height: 17px !important;
    stroke: currentColor !important;
  }

  .heyy-history-name {
    overflow: hidden;
    margin: 0 !important;
    color: #1c2230 !important;
    font-size: 11px !important;
    font-weight: 900 !important;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .heyy-history-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 4px;
  }

  .heyy-history-meta span {
    color: #748094 !important;
    font-size: 9px !important;
    font-weight: 700 !important;
  }

  .heyy-history-download {
    display: inline-flex !important;
    min-height: 35px !important;
    align-items: center !important;
    justify-content: center !important;
    border: 1px solid #d0c2eb !important;
    border-radius: 999px !important;
    background: #ffffff !important;
    color: #5d14bd !important;
    padding: 0 13px !important;
    font-size: 8px !important;
    font-weight: 950 !important;
    letter-spacing: .10em !important;
    text-transform: uppercase !important;
    transition: all 180ms ease !important;
  }

  .heyy-history-download:hover {
    border-color: #7b2cff !important;
    background: #f1e9ff !important;
  }

  .heyy-deliverables-empty {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px dashed #ccb3ff !important;
    border-radius: 18px !important;
    background: linear-gradient(135deg,#f5efff,#ffffff) !important;
    padding: 16px !important;
  }

  .heyy-deliverables-empty-icon {
    display: flex !important;
    width: 39px !important;
    height: 39px !important;
    flex: 0 0 39px !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 12px !important;
    background: #6c00ff !important;
    color: #ffffff !important;
  }

  .heyy-deliverables-empty-icon svg {
    width: 18px !important;
    height: 18px !important;
    stroke: currentColor !important;
  }

  .heyy-deliverables-empty-title {
    margin: 0 !important;
    color: #5911be !important;
    font-size: 12px !important;
    font-weight: 950 !important;
  }

  .heyy-deliverables-empty-copy {
    margin: 4px 0 0 !important;
    color: #6b7282 !important;
    font-size: 10px !important;
    line-height: 1.55 !important;
  }

  .heyy-client-deliverables button:disabled {
    cursor: not-allowed !important;
    opacity: .45 !important;
    transform: none !important;
  }

  [data-theme="dark"] .heyy-client-deliverables {
    color: #f5f2f8 !important;
  }

  [data-theme="dark"] .heyy-client-deliverables :is(
    .heyy-deliverables-intro,
    .heyy-deliverable-card,
    .heyy-deliverable-current,
    .heyy-history-section,
    .heyy-history-row
  ) {
    border-color: #68418f !important;
    background: #2b1838 !important;
  }

  [data-theme="dark"] .heyy-deliverable-card[data-approved="true"] {
    border-color: #2aa66b !important;
    background: #163126 !important;
    box-shadow: 0 16px 34px rgba(0,0,0,.26) !important;
  }

  [data-theme="dark"] .heyy-deliverable-card[data-approved="true"] .heyy-deliverable-current {
    background: linear-gradient(135deg,#173d2c 0%,#1f5139 100%) !important;
  }

  [data-theme="dark"] .heyy-client-deliverables :is(
    .heyy-deliverables-copy,
    .heyy-version-text,
    .heyy-history-meta,
    .heyy-deliverables-empty-copy
  ) {
    color: #bdb4c7 !important;
  }

  [data-theme="dark"] .heyy-client-deliverables :is(
    .heyy-deliverable-name,
    .heyy-history-name,
    .heyy-deliverables-empty-title
  ) {
    color: #f5f2f8 !important;
  }

  [data-theme="dark"] .heyy-send-revision,
  [data-theme="dark"] .heyy-download-final,
  [data-theme="dark"] .heyy-history-download,
  [data-theme="dark"] .heyy-history-toggle {
    border-color: #685a76 !important;
    background: #17131d !important;
    color: #eee8f4 !important;
  }
`;

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

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
