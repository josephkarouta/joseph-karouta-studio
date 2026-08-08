"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";

type Attachment = {
  id: string;
  filename: string;
  mime_type?: string | null;
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

type Props = {
  jobId: string;
  onCountChange?: (count: number) => void;
  embedded?: boolean;
};

const MAX_FILES = 5;

export default function ClientProductionMessages({
  jobId,
  onCountChange,
  embedded = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!jobId) return;
      if (!silent) setLoading(true);

      try {
        const token = await getAccessToken();
        const response = await fetch(
          `/api/production/messages?jobId=${encodeURIComponent(jobId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not load messages.");
        }

        const nextMessages = Array.isArray(data.messages) ? data.messages : [];
        setMessages(nextMessages);
        onCountChange?.(nextMessages.length);
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
    [jobId, onCountChange],
  );

  useEffect(() => {
    void loadMessages();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMessages(true);
      }
    }, 20_000);

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
      const token = await getAccessToken();
      const formData = new FormData();
      formData.set("jobId", jobId);
      formData.set("message", message.trim());
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/production/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not send the message.");
      }

      setMessage("");
      setFiles([]);
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
    <div id="production-messages" className="space-y-4">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-slate-900">
              Messages with Heyy Studio
            </p>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">
              Keep project questions, updates and small reference files together.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadMessages()}
            disabled={loading}
            className="rounded-xl border px-3 py-2 text-[10px] font-black disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      )}

      <div className="max-h-[340px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {loading && messages.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-slate-500">
            Loading conversation…
          </p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
            <p className="text-sm font-black text-slate-800">
              No production messages yet.
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Send a message whenever you need to clarify something with the
              production team.
            </p>
          </div>
        ) : (
          messages.map((item) => (
            <MessageBubble key={item.id} item={item} />
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
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700"
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
        placeholder="Write a message to the Heyy Studio team…"
        className="min-h-[110px] w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
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
            className="rounded-xl border px-4 py-2.5 text-xs font-black disabled:opacity-50"
          >
            Attach files
          </button>
          <span className="text-[9px] font-bold text-slate-400">
            Up to 5 files · 10 MB each
          </span>
        </div>

        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || (!message.trim() && files.length === 0)}
          className="rounded-xl border px-5 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send message →"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {error}
        </p>
      )}

      <p className="text-[9px] leading-5 text-slate-400">
        Press Ctrl/⌘ + Enter to send. Revision requests should still be submitted
        from the Revisions section so they are counted correctly.
      </p>
    </div>
  );
}

function MessageBubble({ item }: { item: Message }) {
  const isClient = item.sender_type === "client";
  const isSystem = item.sender_type === "system";
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[92%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
          System update
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-600">
          {item.message}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl border p-3 ${
          isClient
            ? "border-violet-200 bg-violet-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-black text-slate-800">
            {isClient ? "You" : item.sender_name || "Heyy Studio"}
          </p>
          <p className="text-[9px] font-bold text-slate-400">
            {formatDateTime(item.created_at)}
          </p>
        </div>

        {item.message && (
          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">
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
                className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-[10px] font-black text-slate-700 ${
                  attachment.download_url
                    ? "hover:border-violet-300 hover:text-violet-700"
                    : "pointer-events-none opacity-50"
                }`}
              >
                <span className="min-w-0 truncate">↓ {attachment.filename}</span>
                <span className="shrink-0 text-slate-400">
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

async function getAccessToken() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("Your session expired. Sign in again.");
  }

  return token;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
