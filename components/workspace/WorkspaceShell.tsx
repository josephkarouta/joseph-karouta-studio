"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { PanelsTopLeft } from "lucide-react";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";

const STORAGE_KEY = "heyy-workspace-sidebar-collapsed";

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div
      className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]"
      style={{
        "--workspace-sidebar": collapsed ? "86px" : "270px",
      } as CSSProperties}
    >
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-[calc(var(--header-height)+10px)] z-[55] grid h-9 w-9 place-items-center rounded-full border border-[var(--accent-border)] bg-[color:var(--glass)] text-[var(--accent-strong)] shadow-[0_10px_28px_rgba(35,22,54,.14)] backdrop-blur-2xl transition hover:bg-[var(--accent-soft)] lg:hidden"
        aria-label="Open workspace navigation"
      >
        <PanelsTopLeft size={16} strokeWidth={2.2} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[var(--header-height)] z-50 bg-black/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close workspace navigation"
        />
      )}

      <WorkspaceSidebar
        collapsed={mobileOpen ? false : collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="heyy-workspace-content min-h-screen min-w-0 overflow-x-clip pt-[var(--header-height)] transition-[margin] duration-300 lg:ml-[var(--workspace-sidebar)]">
        {children}
      </div>
    </div>
  );
}
