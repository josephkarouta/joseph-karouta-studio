"use client";

import { useParams } from "next/navigation";
import ArchitectureProjectWorkspace from "@/components/studio/architecture/ArchitectureProjectWorkspace";

export default function ArchitectureProjectPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const rawProjectId = params?.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;

  if (!projectId) return null;

  return <ArchitectureProjectWorkspace projectId={projectId} />;
}
