"use client";

import { useState } from "react";

type Note = {
  id: string;
  text: string;
  created_at: string;
};

export default function InternalNotes({
  id,
  initialNotes,
}: {
  id: number;
  initialNotes: string;
}) {
  const [input, setInput] = useState("");

  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      return JSON.parse(initialNotes || "[]");
    } catch {
      return [];
    }
  });

  const [saving, setSaving] = useState(false);

  async function saveNotes(nextNotes: Note[]) {
    setSaving(true);

    await fetch("/api/update-internal-notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        notes: JSON.stringify(nextNotes),
      }),
    });

    setSaving(false);
  }

  async function addNote() {
    if (!input.trim()) return;

    const newNote: Note = {
      id: crypto.randomUUID(),
      text: input.trim(),
      created_at: new Date().toISOString(),
    };

    const nextNotes = [newNote, ...notes];

    setNotes(nextNotes);
    setInput("");

    await saveNotes(nextNotes);
  }

  async function deleteNote(noteId: string) {
    const nextNotes = notes.filter((note) => note.id !== noteId);

    setNotes(nextNotes);

    await saveNotes(nextNotes);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Internal Notes</h2>

        {saving && <p className="text-sm text-white/40">Saving...</p>}
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addNote();
          }}
          placeholder="Add a note..."
          className="flex-1 rounded-full border border-white/10 bg-black/30 px-5 py-3 text-white outline-none focus:border-purple-400"
        />

        <button
          type="button"
          onClick={addNote}
          className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/90"
        >
          Add
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {notes.length === 0 ? (
          <p className="text-sm text-white/40">No internal notes yet.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="flex w-fit max-w-full items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="text-sm text-white/80">{note.text}</p>

                <p className="mt-2 text-xs text-white/35">
                  {new Date(note.created_at).toLocaleString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => deleteNote(note.id)}
                className="rounded-full border border-red-500/30 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}