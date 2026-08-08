"use client";

import { useWorkspaceStore } from "./use-workspace";

export function useVersions() {
  const {
    versions,
    setVersions,
  } = useWorkspaceStore();

  function addVersion(version: any) {
    setVersions((previous) => [
      version,
      ...previous,
    ]);
  }

  return {
    versions,
    addVersion,
  };
}