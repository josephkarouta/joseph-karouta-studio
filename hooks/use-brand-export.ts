"use client";

import { useState } from "react";
import { exportBrandBookPdf } from "@/lib/export/export-brand-book";

export function useBrandExport() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");

  async function exportBrandBook() {
    if (loading) return;

    try {
      setLoading(true);

      const steps = [
        "Preparing assets...",
        "Collecting pages...",
        "Rendering layouts...",
        "Optimizing images...",
        "Building PDF...",
      ];

      for (const currentStep of steps) {
        setStep(currentStep);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      await exportBrandBookPdf();

      setStep("Export complete.");
    } catch (error) {
      console.error("Brand Book export failed:", error);
      setStep("Export failed. Check the browser console.");
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  }

  return {
    loading,
    step,
    exportBrandBook,
  };
}