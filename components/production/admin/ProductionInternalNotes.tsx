"use client";

type ProductionInternalNotesProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  saved?: boolean;
};

export default function ProductionInternalNotes({
  value,
  onChange,
  onSave,
  saving = false,
  saved = false,
}: ProductionInternalNotesProps) {
  return (
    <section className="rounded-[22px] border border-amber-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Internal Notes</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Private Admin notes. These are never shown to the client.
          </p>
        </div>

        {saved && !saving && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Saved
          </span>
        )}
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 min-h-[240px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
        placeholder="Private production notes..."
      />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="rounded-full border border-amber-500 bg-amber-500 px-5 py-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-amber-600 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving notes..." : "Save internal notes"}
        </button>
      </div>
    </section>
  );
}
