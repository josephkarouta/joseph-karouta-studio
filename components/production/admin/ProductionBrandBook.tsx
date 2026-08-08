"use client";

import Card from "@/components/ui/Card";

type Props = {
  metadata: any;
};

export default function ProductionBrandBook({ metadata }: Props) {
  return (
    <Card title="Brand Book">
      <pre className="overflow-auto rounded-2xl bg-black/40 p-6 text-sm leading-7 text-white/60">
        {JSON.stringify(metadata.generatedGuidelines || metadata || {}, null, 2)}
      </pre>
    </Card>
  );
}