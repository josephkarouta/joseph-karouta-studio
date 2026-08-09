export type ProjectVersionStatus = "draft" | "approved" | "rejected" | "final" | "source";

export interface ProjectVersion {
  id: string;
  familyKey: string;
  sourceKind: string;
  sourceId: string;
  studio: string;
  projectId: string | null;
  version: number;
  title: string;
  assetType: string;
  status: ProjectVersionStatus;
  provider: string | null;
  model: string | null;
  creditCost: number | null;
  changeSummary: string | null;
  userNote: string | null;
  isCurrent: boolean;
  restoredFromVersionId: string | null;
  createdAt: string;
}
