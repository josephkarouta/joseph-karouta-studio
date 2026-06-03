"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Orb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (meshRef.current) {
      meshRef.current.rotation.x = time * 0.25;
      meshRef.current.rotation.y = time * 0.35;
      meshRef.current.scale.setScalar(1 + Math.sin(time * 2) * 0.03);
    }

    if (innerRef.current) {
      innerRef.current.rotation.x = -time * 0.45;
      innerRef.current.rotation.y = time * 0.6;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <group>
        <mesh ref={meshRef}>
          <sphereGeometry args={[1.35, 96, 96]} />
          <meshPhysicalMaterial
            color="#FDDD00"
            transparent
            opacity={0.28}
            roughness={0.1}
            metalness={0.1}
            transmission={0.65}
            thickness={1.2}
            clearcoat={1}
            emissive="#FDDD00"
            emissiveIntensity={0.45}
          />
        </mesh>

        <mesh ref={innerRef}>
          <torusKnotGeometry args={[0.75, 0.035, 240, 24]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#FDDD00"
            emissiveIntensity={1.8}
            roughness={0.15}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.45, 0.008, 16, 180]} />
          <meshBasicMaterial color="#FDDD00" transparent opacity={0.5} />
        </mesh>

        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.5, 0.006, 16, 180]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
        </mesh>

        <pointLight position={[0, 0, 2]} intensity={3} color="#FDDD00" />
      </group>
    </Float>
  );
}

export default function EnergyOrb() {
  return (
    <div className="relative h-96 w-96">
      <div className="absolute inset-0 rounded-full bg-[#FDDD00]/25 blur-[90px]" />

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <pointLight position={[3, 3, 3]} intensity={2} color="#FDDD00" />
        <Orb />
      </Canvas>
    </div>
  );
}