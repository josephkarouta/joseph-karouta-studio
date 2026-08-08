import { useProject } from "@/hooks/use-project";

export default function StudioProjectInfo() {
  const project = useProject();

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
        Project
      </p>

      <div className="mt-5 space-y-3">
        <Info title="Status" value={project.status} />
        <Info title="Version" value={`V${project.version}`} />
        <Info title="Studio" value={project.studio} />
      </div>
    </section>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs text-white/40">{title}</p>

      <p className="mt-1 font-bold capitalize">{value}</p>
    </div>
  );
}