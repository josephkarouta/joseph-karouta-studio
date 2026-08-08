"use client";

export type StudioWorkspaceAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

export default function StudioActionBar({
  actions,
}: {
  actions: StudioWorkspaceAction[];
}) {
  if (!actions.length) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {actions.map((action) =>
        action.href ? (
          <a
            key={action.label}
            href={action.href}
            className="rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-purple-300"
          >
            {action.label}
          </a>
        ) : (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
