import { LoaderCircle, Sparkles } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-[#f7f4fb] px-4 py-8 text-[#17131f] sm:px-8">
      <div className="mx-auto max-w-7xl rounded-[28px] border border-[#e6deef] bg-white p-6 shadow-[0_18px_55px_rgba(39,24,64,.08)] sm:p-8">
        <div className="flex items-center gap-2 text-[.65rem] font-black uppercase tracking-[.2em] text-violet-600">
          <Sparkles size={14} /> Heyy Studio Operations
        </div>
        <div className="mt-5 flex items-center gap-3">
          <LoaderCircle size={20} className="animate-spin text-violet-600" />
          <div>
            <p className="text-lg font-black tracking-[-.03em]">Opening Admin…</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Loading the latest operational data.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
