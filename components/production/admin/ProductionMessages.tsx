"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

type Props = {
  jobId: string;
  onRead?: () => void;
};

type Attachment = {
  id: string;
  filename: string;
  file_size?: number | null;
  download_url?: string | null;
};

type Message = {
  id: string;
  sender_type: "client" | "studio" | "system" | string;
  sender_name?: string | null;
  message: string;
  created_at: string;
  attachments?: Attachment[];
};

const MAX_FILES = 5;

export default function ProductionMessages({ jobId, onRead }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newClientMessages, setNewClientMessages] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!jobId) return;
      if (!silent) setLoading(true);

      try {
        const response = await fetch(
          `/api/admin/production-messages?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not load messages.");
        }

        setMessages(Array.isArray(data.messages) ? data.messages : []);
        if (Number(data.unreadClientCount || 0) > 0) {
          setNewClientMessages(Number(data.unreadClientCount));
          onRead?.();
        }
        setError("");
      } catch (loadError) {
        if (!silent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load messages.",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [jobId, onRead],
  );

  useEffect(() => {
    void loadMessages();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(true);
      }
    }, 15_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadMessages(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function sendMessage() {
    if ((!message.trim() && files.length === 0) || sending) return;

    setSending(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("jobId", jobId);
      formData.set("message", message.trim());
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/admin/production-messages", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not send the message.");
      }

      setMessage("");
      setFiles([]);
      setNewClientMessages(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadMessages(true);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send the message.",
      );
    } finally {
      setSending(false);
    }
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
      return unique.slice(0, MAX_FILES);
    });
    event.target.value = "";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-950">
              Client conversation
            </p>
            {newClientMessages > 0 && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-700">
                {newClientMessages} new
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            Messages here are visible to the client. Internal notes remain in
            the separate private tab.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewClientMessages(0);
            void loadMessages();
          }}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-[20px] border border-slate-200 bg-slate-50 p-4">
        {loading && messages.length === 0 ? (
          <p className="py-10 text-center text-sm font-bold text-slate-500">
            Loading conversation…
          </p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white p-6 text-center">
            <p className="text-sm font-black text-slate-900">
              No production messages yet.
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Send the first update after production begins. The client will
              receive a bell notification and email.
            </p>
          </div>
        ) : (
          messages.map((item) => (
            <AdminMessageBubble key={item.id} item={item} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <button
              key={`${file.name}-${file.size}-${index}`}
              type="button"
              onClick={() =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
              title="Remove attachment"
            >
              {file.name} · {formatFileSize(file.size)} ×
            </button>
          ))}
        </div>
      )}

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void sendMessage();
          }
        }}
        maxLength={3_000}
        placeholder="Send a production update or answer the client…"
        className="min-h-[135px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
            disabled={files.length >= MAX_FILES || sending}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-xs font-black text-slate-700 transition hover:border-violet-500 hover:text-violet-700 disabled:opacity-50"
          >
            Attach files
          </button>
          <span className="text-[10px] font-bold text-slate-400">
            Up to 5 files · 10 MB each
          </span>
        </div>

        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || (!message.trim() && files.length === 0)}
          className="rounded-2xl border border-slate-950 bg-slate-950 px-6 py-3 font-black text-white transition hover:-translate-y-0.5 hover:border-violet-600 hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-600/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send to Client →"}
        </button>
      </div>

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          {error}
        </p>
      )}

      <p className="text-[10px] leading-5 text-slate-400">
        Press Ctrl/⌘ + Enter to send. Use Deliverables or Revisions for formal
        production files; this attachment area is for references and discussion.
      </p>
    </div>
  );
}

function AdminMessageBubble({ item }: { item: Message }) {
  const isStudio = item.sender_type === "studio";
  const isSystem = item.sender_type === "system";
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[86%] rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
          System update
        </p>
        <p className="mt-1 text-xs leading-6 text-slate-600">{item.message}</p>
      </div>
    );
  }

  return (
    <div className={`flex ${isStudio ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl border p-4 ${
          isStudio
            ? "border-violet-200 bg-violet-50"
            : "border-blue-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-900">
            {isStudio ? item.sender_name || "Heyy Studio" : item.sender_name || "Client"}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {formatDateTime(item.created_at)}
          </p>
        </div>

        {item.message && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {item.message}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.download_url || undefined}
                download={attachment.filename}
                aria-disabled={!attachment.download_url}
                className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700 transition ${
                  attachment.download_url
                    ? "hover:border-violet-300 hover:text-violet-700"
                    : "pointer-events-none opacity-50"
                }`}
              >
                <span className="min-w-0 truncate">↓ {attachment.filename}</span>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {formatFileSize(attachment.file_size || 0)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
