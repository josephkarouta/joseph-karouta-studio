"use client";

import type { ReactNode } from "react";

export type StudioStep = {
  id: string;
  label: string;
  status?: "done" | "active" | "locked" | "upcoming";
  helper?: string;
  icon?: ReactNode;
  tabId?: string;
};

export default function StudioStepper({
  steps,
  activeTab,
  onStepClick,
}: {
  steps: StudioStep[];
  activeTab?: string;
  onStepClick?: (step: StudioStep) => void;
}) {
  if (!steps.length) return null;

  return (
    <section className="heyy-studio-stepper">
      <style>{`
        .heyy-studio-stepper {
          overflow: visible;
          border: 1px solid #ddd5e7;
          border-radius: 23px;
          background: #fff;
          padding: 8px;
          box-shadow: 0 12px 28px rgba(35,24,51,.065);
        }

        .heyy-stepper-track {
          display: flex;
          gap: 7px;
          overflow-x: auto;
          overflow-y: visible;
          padding: 4px 2px;
          scrollbar-width: thin;
        }

        .heyy-step {
          min-width: 190px;
          flex: 1 0 190px;
          border: 1px solid transparent !important;
          border-radius: 17px !important;
          background: #faf9fc !important;
          color: #17151f !important;
          padding: 12px !important;
          text-align: left !important;
          transition: all 190ms ease !important;
        }

        .heyy-step:hover:not(:disabled):not([data-active="true"]) {
          transform: translateY(0);
          border-color: #8c4dff !important;
          background: #eee2ff !important;
          color: #4d00b5 !important;
        }

        .heyy-step[data-active="true"],
        .heyy-step[data-active="true"]:hover {
          transform: translateY(0);
          border-color: #5a00d2 !important;
          background: linear-gradient(135deg,#5200c2,#7c18ff) !important;
          color: #fff !important;
          box-shadow: 0 11px 25px rgba(108,0,255,.25) !important;
        }

        .heyy-step[data-active="true"] p,
        .heyy-step[data-active="true"]:hover p {
          color: #fff !important;
        }

        .heyy-step[data-active="true"] p:last-child,
        .heyy-step[data-active="true"]:hover p:last-child {
          color: rgba(255,255,255,.74) !important;
        }

        .heyy-step[data-done="true"]:not([data-active="true"]) {
          border-color: #b7e8ce !important;
          background: #edfff4 !important;
          color: #173c2a !important;
        }

        .heyy-step[data-done="true"]:not([data-active="true"]):hover {
          border-color: #19a965 !important;
          background: #dff8ea !important;
          color: #0c6d3e !important;
        }

        .heyy-step[data-locked="true"] {
          cursor: not-allowed !important;
          opacity: .48 !important;
        }

        .heyy-step-circle {
          display: flex !important;
          width: 32px !important;
          height: 32px !important;
          flex: 0 0 32px !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 11px !important;
          background: #ece8f0 !important;
          color: #615968 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .heyy-step[data-active="true"] .heyy-step-circle,
        .heyy-step[data-active="true"]:hover .heyy-step-circle {
          background: rgba(255,255,255,.18) !important;
          color: #fff !important;
        }

        .heyy-step[data-done="true"]:not([data-active="true"]) .heyy-step-circle {
          background: #13b96b !important;
          color: #fff !important;
        }
      `}</style>

      <div className="heyy-stepper-track">
        {steps.map((step, index) => {
          const locked = step.status === "locked";
          const done = step.status === "done";
          const active =
            step.status === "active" ||
            Boolean(step.tabId && step.tabId === activeTab);

          return (
            <button
              key={step.id}
              type="button"
              disabled={locked || !step.tabId}
              onClick={() => onStepClick?.(step)}
              className="heyy-step"
              data-active={active ? "true" : "false"}
              data-done={done ? "true" : "false"}
              data-locked={locked ? "true" : "false"}
            >
              <div className="flex items-center gap-3">
                <span className="heyy-step-circle">
                  {done ? "✓" : locked ? <LockIcon /> : index + 1}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{step.label}</p>
                  {step.helper && (
                    <p className="mt-1 truncate text-[10px] text-slate-500">
                      {step.helper}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
