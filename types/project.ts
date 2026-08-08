export type ProjectStatus =
  | "active"
  | "draft"
  | "review"
  | "completed";

export interface ProjectContext {
  id: string;

  name: string;

  studio: string;

  status: ProjectStatus;

  version: number;

  createdAt?: string;

  updatedAt?: string;

  ownerId?: string;
}