"use client";

import { useMemo } from "react";
import PresentationExportControls from "@/components/presentation/PresentationExportControls";
import { buildArchitecturePresentation } from "@/lib/presentation/build-architecture-presentation";

export default function ArchitecturePresentationExport({
  project,
  site,
  planning,
  direction,
  concept,
  planSet,
  visuals,
  materials,
  spaceProgram,
}: {
  project: any;
  site: any;
  planning: any;
  direction: any;
  concept: any;
  planSet: any;
  visuals: any[];
  materials: any[];
  spaceProgram: any[];
}) {
  const presentation = useMemo(
    () =>
      buildArchitecturePresentation({
        project,
        site,
        planning,
        direction,
        concept,
        planSet,
        visuals,
        materials,
        spaceProgram,
      }),
    [
      concept,
      direction,
      materials,
      planSet,
      planning,
      project,
      site,
      spaceProgram,
      visuals,
    ],
  );

  return (
    <div className="architecture-presentation-export">
      <PresentationExportControls
        document={presentation}
        rootId={`architecture-presentation-${project?.id || "project"}`}
        compact
      />
    </div>
  );
}
