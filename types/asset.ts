export type AssetType =
  | "moodboard"
  | "logo"
  | "image"
  | "render"
  | "video"
  | "document";

export interface ProjectAsset {
  id: string;

  projectId: string;

  type: AssetType;

  title: string;

  thumbnail?: string;

  createdAt?: string;

  version?: number;
}