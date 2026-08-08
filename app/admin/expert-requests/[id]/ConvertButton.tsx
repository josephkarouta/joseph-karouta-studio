"use client";

import { useState } from "react";

export default function ConvertButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false);

  async function convertToLead() {
    try {
      setLoading(true);

      const response = await fetch("/api/convert-expert-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Lead created successfully");
        window.location.href = "/admin";
        return;
      }

      alert("Could not convert request. Please try again.");
    } catch (error) {
      console.error(error);
      alert("Could not convert request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={convertToLead}
      disabled={loading}
      className="rounded-full bg-white px-5 py-3 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50"
    >
      {loading ? "Converting..." : "Convert To Lead"}
    </button>
  );
}