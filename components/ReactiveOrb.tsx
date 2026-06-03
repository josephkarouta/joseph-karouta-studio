"use client";

type ReactiveOrbProps = {
  isTyping: boolean;
};

export default function ReactiveOrb({ isTyping }: ReactiveOrbProps) {
  return (
    <div className="relative flex h-80 w-80 items-center justify-center">
      <div
        className={`absolute rounded-full bg-[#FDDD00]/25 blur-[80px] ${
          isTyping ? "h-80 w-80 animate-pulse" : "h-64 w-64"
        }`}
      />

      <div className={`orb-core ${isTyping ? "orb-thinking" : ""}`}>
        <div className="orb-layer orb-layer-one" />
        <div className="orb-layer orb-layer-two" />
        <div className="orb-layer orb-layer-three" />
        <div className="orb-shine" />
      </div>
    </div>
  );
}