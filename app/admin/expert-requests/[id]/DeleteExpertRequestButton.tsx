"use client";

import { useState } from "react";

export default function DeleteExpertRequestButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false);

  async function deleteRequest() {
    const confirmed = window.confirm(
      "Delete this expert request? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const response = await fetch("/api/delete-expert-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = "/admin/expert-requests";
        return;
      }

      alert("Could not delete request. Please try again.");
    } catch (error) {
      console.error(error);
      alert("Could not delete request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={deleteRequest}
      disabled={loading}
      className="rounded-full border border-red-500/30 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
    >
      {loading ? "Deleting..." : "Delete Request"}
    </button>
  );
}