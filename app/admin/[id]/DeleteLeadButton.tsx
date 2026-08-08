"use client";

import { useState } from "react";

export default function DeleteLeadButton({
  id,
}: {
  id: number;
}) {
  const [loading, setLoading] = useState(false);

  async function deleteLead() {
    const confirmed = window.confirm(
      "Delete this lead? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const response = await fetch("/api/delete-lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = "/admin";
        return;
      }

      alert("Could not delete lead.");
    } catch (error) {
      console.error(error);
      alert("Could not delete lead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={deleteLead}
      disabled={loading}
      className="rounded-full border border-red-500/30 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete Lead"}
    </button>
  );
}