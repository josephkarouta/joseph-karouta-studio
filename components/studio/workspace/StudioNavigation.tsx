"use client";

import type { StudioStep } from "./StudioStepper";

export default function StudioNavigation({
  steps,
  activeTab,
  onNavigate,
}: {
  steps: StudioStep[];
  activeTab: string;
  onNavigate: (tabId: string) => void;
}) {
  const navigableSteps = steps.filter(
    (step) => step.tabId && step.status !== "locked",
  );

  const currentIndex = navigableSteps.findIndex(
    (step) => step.tabId === activeTab,
  );

  const previousStep =
    currentIndex > 0 ? navigableSteps[currentIndex - 1] : null;

  const nextStep =
    currentIndex >= 0 && currentIndex < navigableSteps.length - 1
      ? navigableSteps[currentIndex + 1]
      : null;

  return (
    <div className="heyy-studio-navigation">
      <style>{`
        .heyy-studio-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 18px;
          border: 1px solid #ded7e7;
          border-radius: 20px;
          background: #fff;
          padding: 14px;
          box-shadow: 0 10px 24px rgba(35,24,51,.05);
        }

        .heyy-nav-button {
          display: inline-flex;
          min-height: 43px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          padding: 0 17px;
          font-size: 12px;
          font-weight: 900;
          transition: all 190ms ease;
        }

        .heyy-nav-button[data-tone="back"] {
          border: 1px solid #d6cedf;
          background: #fff;
          color: #3f3747;
        }

        .heyy-nav-button[data-tone="next"] {
          border: 1px solid #6c00ff;
          background: #6c00ff;
          color: #fff;
          box-shadow: 0 10px 22px rgba(108,0,255,.20);
        }

        .heyy-nav-button:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .heyy-nav-button[data-tone="back"]:hover:not(:disabled) {
          border-color: #9b63ff;
          background: #f2e9ff;
          color: #5b00d6;
        }

        .heyy-nav-button[data-tone="next"]:hover:not(:disabled) {
          border-color: #4c00b4;
          background: #4c00b4;
          box-shadow: 0 13px 27px rgba(108,0,255,.27);
        }

        .heyy-nav-button:disabled {
          cursor: not-allowed;
          opacity: .35;
        }

        @media (max-width: 600px) {
          .heyy-nav-button {
            width: 100%;
          }
        }
      `}</style>

      <button
        type="button"
        disabled={!previousStep?.tabId}
        onClick={() => previousStep?.tabId && onNavigate(previousStep.tabId)}
        className="heyy-nav-button"
        data-tone="back"
      >
        ← Previous
      </button>

      <button
        type="button"
        disabled={!nextStep?.tabId}
        onClick={() => nextStep?.tabId && onNavigate(nextStep.tabId)}
        className="heyy-nav-button"
        data-tone="next"
      >
        {nextStep ? `Next: ${nextStep.label} →` : "Workflow Complete ✓"}
      </button>
    </div>
  );
}
