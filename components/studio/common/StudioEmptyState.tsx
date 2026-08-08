type StudioEmptyStateProps = {
  eyebrow?: string;
  title: string;
  body: string;
  buttonLabel?: string;
};

export default function StudioEmptyState({
  eyebrow = "Coming Next",
  title,
  body,
  buttonLabel,
}: StudioEmptyStateProps) {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-3xl font-black">{title}</h2>

      <p className="mx-auto mt-4 max-w-xl leading-7 text-white/55">{body}</p>

      {buttonLabel && (
        <button
          type="button"
          disabled
          className="mt-6 rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white opacity-40"
        >
          {buttonLabel}
        </button>
      )}
    </section>
  );
}