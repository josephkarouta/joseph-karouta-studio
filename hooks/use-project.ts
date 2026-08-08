"use client";

import { useWorkspaceStore } from "./use-workspace";

export function useProject() {
  const { project } = useWorkspaceStore();

  return project;
}