"use client";

import { useWorkspaceStore } from "./use-workspace";
import {
  createProjectAsset,
  getProjectAssets,
} from "@/services/workspace/asset.service";

export function useAssets() {
  const {
    project,
    assets,
    setAssets,
  } = useWorkspaceStore();

  async function refreshAssets() {
    const data = await getProjectAssets(project.id);

    setAssets(data);
  }

  async function addAsset(asset: any) {
    const created = await createProjectAsset(asset);

    setAssets((previous) => [
      created,
      ...previous,
    ]);

    return created;
  }

  return {
    assets,
    refreshAssets,
    addAsset,
  };
}