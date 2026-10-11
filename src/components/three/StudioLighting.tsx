"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { useStageStore } from "./stageStore";

/**
 * Local studio lighting — lightformers instead of a remote HDR so the scene
 * makes no network requests — plus a soft contact shadow under the cap.
 */
export function StudioLighting({ rimColor, shadowY = -0.06 }: { rimColor: string; shadowY?: number }) {
  const quality = useStageStore((s) => s.quality);

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2.5, -3]} intensity={1.6} color={rimColor} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 5, -2]} scale={[10, 5, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 1, 1]} scale={[3, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1} position={[5, 1, 1]} scale={[3, 8, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
      {quality === "high" && (
        <ContactShadows position={[0, shadowY, 0]} opacity={0.5} scale={7} blur={2.4} far={2.5} resolution={512} />
      )}
    </>
  );
}
