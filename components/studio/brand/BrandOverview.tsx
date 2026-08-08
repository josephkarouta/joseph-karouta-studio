import StudioCard from "@/components/studio/common/StudioCard";
import StudioSection from "@/components/studio/common/StudioSection";

export default function BrandOverview({
  project,
  brand,
}: {
  project: any;
  brand: any;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <StudioSection
        eyebrow="Project Summary"
        title={brand?.summary || project.project_name}
        className="lg:col-span-2"
      >
        <p className="leading-8 text-white/60">
          {brand?.brandStrategy?.description ||
            "This Brand Studio project is saved and ready to expand into moodboards, logo concepts, assets and expert review."}
        </p>
      </StudioSection>

      <StudioSection eyebrow="Next Actions">
        <div className="grid gap-3">
          {[
            "Review Brand System",
            "Generate Moodboard",
            "Generate Logo Concepts",
            "Request Expert Review",
          ].map((item) => (
            <StudioCard key={item} className="p-4">
              <p className="text-sm text-white/65">{item}</p>
            </StudioCard>
          ))}
        </div>
      </StudioSection>
    </div>
  );
}