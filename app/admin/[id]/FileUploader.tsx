"use client";

import { useState, useRef } from "react";

export default function FileUploader({ leadId }: { leadId: number }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("leadId", String(leadId));

    const res = await fetch("/api/upload-file", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      setMessage("File uploaded successfully.");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setMessage("Upload failed. Please try again.");
    }

    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
        dragging
          ? "border-purple-400 bg-purple-500/10"
          : "border-white/20 hover:border-white/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />
      {uploading ? (
        <p className="text-white/50">Uploading...</p>
      ) : (
        <p className="text-white/50">Drag a file here or click to upload</p>
      )}
      {message && (
        <p className="mt-2 text-sm text-purple-400">{message}</p>
      )}
    </div>
  );
}
