"use client";

type Props = {
  projectTypeLabel: string;
  projectName: string;
  statusLabel: string;
  metaItems: string[];
};

export default function StudioHeader({
  projectTypeLabel,
  projectName,
  statusLabel,
  metaItems,
}: Props) {
  return (
    <section className="heyy-studio-header">
      <style>{`
        .heyy-studio-header {
          position: relative;
          overflow: hidden;
          margin-top: 18px;
          border: 1px solid #d6c4f3;
          border-radius: 29px;
          background:
            radial-gradient(circle at 86% 18%, rgba(126,39,255,.27), transparent 27%),
            radial-gradient(circle at 69% 100%, rgba(255,62,188,.12), transparent 30%),
            linear-gradient(135deg,#ffffff 0%,#f6efff 58%,#eadcff 100%);
          padding: 28px 30px;
          box-shadow: 0 20px 46px rgba(70,38,111,.10);
        }

        .heyy-studio-header::after {
          content: "/";
          position: absolute;
          right: 30px;
          top: 50%;
          transform: translateY(-50%) rotate(20deg);
          color: rgba(255,255,255,.76);
          font-size: 190px;
          font-weight: 900;
          line-height: 1;
          pointer-events: none;
        }

        .heyy-studio-header-grid {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .heyy-studio-header-icon {
          display: flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
          background: linear-gradient(135deg,#5b00d6,#8128ff);
          color: #fff;
          box-shadow: 0 12px 25px rgba(108,0,255,.24);
        }

        .heyy-project-status {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #b992ff;
          border-radius: 999px;
          background: #6c00ff;
          color: #fff;
          padding: 0 15px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .15em;
          text-transform: uppercase;
          box-shadow: 0 10px 22px rgba(108,0,255,.20);
        }

        .heyy-project-status::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #7df0b6;
          box-shadow: 0 0 0 4px rgba(125,240,182,.18);
        }

        @media (max-width: 650px) {
          .heyy-studio-header {
            padding: 24px 19px;
          }

          .heyy-studio-header::after {
            display: none;
          }
        }
      `}</style>

      <div className="heyy-studio-header-grid">
        <div>
          <div className="flex items-center gap-3">
            <span className="heyy-studio-header-icon">
              <BrandStudioIcon />
            </span>

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-600">
              {projectTypeLabel}
            </p>
          </div>

          <h1 className="mt-5 text-4xl font-black leading-none tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">
            {projectName}
          </h1>

          {metaItems.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {metaItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-slate-600"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className="heyy-project-status">{statusLabel}</span>
      </div>
    </section>
  );
}

function BrandStudioIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5" />
      <circle cx="17" cy="16" r="2" />
    </svg>
  );
}
