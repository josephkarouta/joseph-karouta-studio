"use client";

export function BrandBookExportCover({
  project,
  logo,
  moodboard,
}:{
  project:any;
  logo?:any;
  moodboard?:any;
}){
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 min-h-[620px]">
      {moodboard?.imageUrl && (
        <img
          src={moodboard.imageUrl}
          className="absolute inset-0 h-full w-full object-cover"
          alt=""
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-purple-950/70"/>

      <div className="relative flex h-[620px] flex-col justify-between p-12">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-purple-300">
            Heyy Studio • Brand Guidelines
          </p>

          <h1 className="mt-8 max-w-4xl text-7xl font-black leading-[0.9] tracking-[-0.08em]">
            {project?.project_name}
          </h1>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-white/50">Professional Brand Guidelines</p>
          </div>

          {logo?.imageUrl && (
            <div className="rounded-3xl bg-white p-6">
              <img src={logo.imageUrl} className="h-24 w-24 object-contain"/>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
