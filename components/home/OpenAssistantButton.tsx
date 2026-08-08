"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/heyy";

export default function OpenAssistantButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent("heyy-assistant-open"))}
    >
      <Sparkles size={16} /> Ask Heyy AI
    </Button>
  );
}
