"use client";

import { useActivity } from "@/hooks/use-activity";

export default function StudioActivity() {
  const { activity } = useActivity();

  if (activity.length === 0) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
          Activity
        </p>

        <p className="mt-6 text-sm text-white/50">
          No activity yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
        Activity
      </p>

      <div className="mt-6 space-y-5">
        {activity.map((item) => (
          <div
            key={item.id}
            className="border-l border-purple-500/30 pl-4"
          >
            <h4 className="font-bold">{item.title}</h4>

            <p className="mt-1 text-sm text-white/55">
              {item.description}
            </p>

            <p className="mt-2 text-xs text-white/30">
              {item.createdAt}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}