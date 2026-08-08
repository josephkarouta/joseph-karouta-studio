"use client";

import Card from "@/components/ui/Card";

type Props = {
  metadata: any;
};

export default function ProductionBrandSystem({ metadata }: Props) {
  return (
    <div className="space-y-6">
      <Card title="Brand Summary">
        <p className="leading-8 text-white/60">
          {metadata.generatedGuidelines?.summary ||
            metadata.summary ||
            "No summary available."}
        </p>
      </Card>

      <Card title="Brand Strategy">
        <p className="leading-8 text-white/60">
          {metadata.brandStrategy?.description ||
            metadata.generatedGuidelines?.strategy ||
            "No strategy available."}
        </p>
      </Card>

      <Card title="Target Audience">
        <p className="leading-8 text-white/60">
          {metadata.generatedGuidelines?.targetAudience ||
            "No audience available."}
        </p>
      </Card>

      <Card title="Brand Voice">
        <p className="leading-8 text-white/60">
          {metadata.brandVoice?.description ||
            metadata.generatedGuidelines?.toneOfVoice?.description ||
            "No brand voice available."}
        </p>
      </Card>
    </div>
  );
}