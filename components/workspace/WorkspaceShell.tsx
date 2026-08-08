"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import WorkspaceSidebar from "@/components/workspace/WorkspaceSidebar";

const STORAGE_KEY = "heyy-workspace-sidebar-collapsed";

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

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
        className="fixed left-4 top-[calc(var(--header-height)+14px)] z-40 grid h-11 w-11 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--accent-strong)] shadow-[var(--shadow-card)] backdrop-blur-xl lg:hidden"
        aria-label="Open workspace navigation"
      >
        <Menu size={19} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[var(--header-height)] z-40 bg-black/35 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close workspace navigation"
        />
      )}

      <WorkspaceSidebar
        collapsed={collapsed}
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
