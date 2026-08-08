"use client";

export default function FileAttachments({ attachments }: { attachments: string[] }) {
  if (!attachments || attachments.length === 0) {
    return <p className="text-white/50">No files uploaded.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {attachments.map((file, index) => (
          <a
            key={file}
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[#A78BFA] hover:underline"
          >
            Attachment {index + 1}
          </a>
        ))}
      </div>
    </div>
  );
}
