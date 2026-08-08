"use client";

import { useWorkspaceStore } from "./use-workspace";

export function useActivity() {
  const {
    activity,
    setActivity,
  } = useWorkspaceStore();

  function addActivity(item: any) {
    setActivity((previous) => [
      item,
      ...previous,
    ]);
  }

  return {
    activity,
    addActivity,
  };
}