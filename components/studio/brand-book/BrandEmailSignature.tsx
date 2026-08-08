"use client";

function slug(value: string) {
  return String(value || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export default function BrandEmailSignature({
  project,
  logo,
}: {
  project: any;
  logo?: any;
}) {
  const name = project?.project_name || "Brand";
  const domain = slug(name);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 md:p-10">
      <p className="text-xs uppercase tracking-[0.35em] text-purple-300">
        Email Signature
      </p>

      <h2 className="mt-4 text-4xl font-black">Communication system</h2>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <SignatureCard title="Desktop signature">
          <div className="flex gap-5 rounded-3xl bg-white p-6 text-black">
            {logo?.imageUrl ? (
              <img src={logo.imageUrl} className="h-20 w-20 object-contain" />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-black" />
            )}

            <div className="border-l border-black/10 pl-5">
              <h3 className="text-xl font-black">{name}</h3>
              <p className="mt-1 text-sm text-black/50">Creative Team</p>
              <p className="mt-4 text-sm text-black/50">hello@{domain}.com</p>
              <p className="text-sm text-black/50">www.{domain}.com</p>
            </div>
          </div>
        </SignatureCard>

        <SignatureCard title="Mobile signature">
          <div className="rounded-3xl bg-white p-6 text-black">
            <h3 className="text-xl font-black">{name}</h3>
            <p className="mt-1 text-sm text-black/50">hello@{domain}.com</p>
            <div className="mt-5 h-1.5 w-20 rounded-full bg-black" />
          </div>
        </SignatureCard>
      </div>
    </section>
  );
}

function SignatureCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
      {children}
      <p className="mt-5 font-black">{title}</p>
    </div>
  );
}
