"use client";

import { useWorkspace } from "@/contexts/WorkspaceContext";

export function useWorkspaceStore() {
  return useWorkspace();
}