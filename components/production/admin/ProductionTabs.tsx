"use client";

type ProductionTabsProps = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

const tabMeta: Record<string, { description: string; tone: string }> = {
  Workbench: {
    description: "Revisions, final files and activity",
    tone: "violet",
  },
  Communication: {
    description: "Client messages and private notes",
    tone: "blue",
  },
  "Project Context": {
    description: "Brief, brand and source material",
    tone: "amber",
  },
};

export default function ProductionTabs({
  tabs,
  activeTab,
  onChange,
}: ProductionTabsProps) {
  return (
    <nav
      aria-label="Production workspace sections"
      className="rounded-[24px] border border-violet-200 bg-white p-2 shadow-lg shadow-slate-900/5"
    >
      <div className="grid gap-2 md:grid-cols-3">
        {tabs.map((item) => {
          const active = activeTab === item;
          const meta = tabMeta[item];

          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-pressed={active}
              className={`rounded-[18px] border px-4 py-4 text-left transition-all duration-200 ${
                active
                  ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "border-transparent bg-slate-50 text-slate-700 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-black">
                <span
                  className={`h-2 w-2 rounded-full ${
                    active
                      ? "bg-white"
                      : meta?.tone === "blue"
                        ? "bg-blue-500"
                        : meta?.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-violet-500"
                  }`}
                />
                {item}
              </span>

              <span
                className={`mt-1.5 block text-xs leading-5 ${
                  active ? "text-white/75" : "text-slate-500"
                }`}
              >
                {meta?.description}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
