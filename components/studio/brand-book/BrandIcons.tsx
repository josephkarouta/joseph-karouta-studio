"use client";

import BrandBookPage from "@/components/studio/brand-book/BrandBookPage";

const icons = [
  {
    title: "Monoline",
    icon: "⌁",
    body: "Single stroke icons for interfaces, presentations and product UI.",
  },
  {
    title: "Geometric",
    icon: "◇",
    body: "Built from simple geometric forms with balanced proportions.",
  },
  {
    title: "Filled",
    icon: "●",
    body: "Use only for navigation, notifications and small UI states.",
  },
  {
    title: "System",
    icon: "✦",
    body: "Every icon should belong to one consistent visual family.",
  },
];

export default function BrandIcons() {
  return (
    <BrandBookPage
      page={11}
      eyebrow="Iconography"
      title="Icon System"
    >
      <p className="max-w-3xl text-sm leading-6 text-white/50">
        Icons support communication. Keep them clean, consistent and secondary
        to the brand message.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_1fr]">
        {/* Guidelines */}
        <div className="space-y-3">
          <Rule text="Use one stroke weight throughout the system." />
          <Rule text="Avoid unnecessary decorative details." />
          <Rule text="Icons should clarify actions, not become illustrations." />
          <Rule text="Keep spacing and corner radius consistent." />
        </div>

        {/* Examples */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {icons.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-3xl text-purple-200">
                {item.icon}
              </div>

              <h3 className="mt-4 text-base font-black">
                {item.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/55">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </BrandBookPage>
  );
}

function Rule({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-white/65">
        ✓ {text}
      </p>
    </div>
  );
}