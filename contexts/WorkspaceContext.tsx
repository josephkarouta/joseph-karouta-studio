"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ProjectContext } from "@/types/project";
import { ProjectAsset } from "@/types/asset";
import { WorkspaceActivity } from "@/types/activity";
import { ProjectVersion } from "@/types/version";

type WorkspaceContextType = {
  project: ProjectContext;

  assets: ProjectAsset[];
  setAssets: React.Dispatch<React.SetStateAction<ProjectAsset[]>>;

  activity: WorkspaceActivity[];
  setActivity: React.Dispatch<React.SetStateAction<WorkspaceActivity[]>>;

  versions: ProjectVersion[];
  setVersions: React.Dispatch<React.SetStateAction<ProjectVersion[]>>;
};

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: {
    project: ProjectContext;
    assets: ProjectAsset[];
    activity: WorkspaceActivity[];
    onAssetsChange?: (assets: ProjectAsset[]) => void;
  };
  children: ReactNode;
}) {
  const { project, assets: incomingAssets, activity: incomingActivity, onAssetsChange } = value;

  const [assets, setAssets] = useState<ProjectAsset[]>(incomingAssets);
  const [activity, setActivity] = useState<WorkspaceActivity[]>(incomingActivity);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);

  const hasMountedRef = useRef(false);

  useEffect(() => {
    setAssets(incomingAssets);
  }, [incomingAssets]);

  useEffect(() => {
    setActivity(incomingActivity);
  }, [incomingActivity]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    onAssetsChange?.(assets);
  }, [assets, onAssetsChange]);

  const context = useMemo(
    () => ({
      project,

      assets,
      setAssets,

      activity,
      setActivity,

      versions,
      setVersions,
    }),
    [project, assets, activity, versions]
  );

  return (
    <WorkspaceContext.Provider value={context}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }

  return context;
}
