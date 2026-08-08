"use client";

type ProductionHeaderProps = {
  projectName: string;
  service: string;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
};

export default function ProductionHeader({
  projectName,
  service,
  saving,
  onBack,
  onSave,
}: ProductionHeaderProps) {
  return (
    <>
      <button
        onClick={onBack}
        className="mb-8 text-sm font-bold text-white/50 transition hover:text-white"
      >
        ← Back to Production
      </button>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-purple-300/60">
            Production Workspace
          </p>

          <h1 className="mt-3 text-5xl font-black tracking-[-0.06em] text-white">
            {projectName}
          </h1>

          <p className="mt-3 text-white/45">
            {service}
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-2xl bg-white px-7 py-4 font-black text-black transition hover:scale-[1.02] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}