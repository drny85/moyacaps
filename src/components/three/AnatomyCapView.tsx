"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { CapModel } from "./CapModel";
import { StudioLighting } from "./StudioLighting";
import { useViewVisibility } from "./useViewVisibility";

interface Keyframe {
  rotation: number;
  camera: [number, number, number];
  lookAt: [number, number, number];
  explode: number;
}

/**
 * Camera path for the anatomy walkthrough, one keyframe per stop.
 * Model rotation +90° turns the left temple toward the camera, 180° the rear.
 */
export const ANATOMY_KEYFRAMES: Keyframe[] = [
  { rotation: 0, camera: [0, 0.8, 3.4], lookAt: [0, 0.45, 0.5], explode: 0 }, // front puff
  { rotation: Math.PI / 2, camera: [0.35, 0.7, 4.4], lookAt: [0.35, 0.35, 0], explode: 0 }, // devil flank
  { rotation: Math.PI, camera: [0, 0.85, 3.8], lookAt: [0, 0.4, -0.2], explode: 0 }, // 0880 rear
  { rotation: Math.PI * 1.75, camera: [0, 1.4, 6.2], lookAt: [0, 0.35, 0.2], explode: 1 }, // exploded
  { rotation: Math.PI * 2 - 0.4, camera: [0, 1.1, 5], lookAt: [0, 0.4, 0.3], explode: 0 }, // reassembled
];

const { damp, lerp, smoothstep } = THREE.MathUtils;

/** Keyframes are framed for a landscape view; narrower views pull the camera back */
const FRAMED_ASPECT = 1.6;

/** Scroll progress → keyframe pair + eased blend, holding on each stop */
function sampleKeyframes(progress: number) {
  const span = Math.min(Math.max(progress, 0), 1) * (ANATOMY_KEYFRAMES.length - 1);
  const index = Math.min(Math.floor(span), ANATOMY_KEYFRAMES.length - 2);
  const blend = smoothstep(span - index, 0.2, 0.8);
  return { from: ANATOMY_KEYFRAMES[index], to: ANATOMY_KEYFRAMES[index + 1], blend };
}

function AnatomyScene({
  progress,
  primaryHex,
  secondaryHex,
}: {
  progress: MotionValue<number>;
  primaryHex: string;
  secondaryHex: string;
}) {
  const turntable = useRef<THREE.Group>(null);
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const lookAt = useRef(new THREE.Vector3(0, 0.5, 0.5));
  const lookTarget = useRef(new THREE.Vector3());
  const explode = useRef(0);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const { from, to, blend } = sampleKeyframes(progress.get());
    const cam = camera.current;
    const group = turntable.current;
    if (!cam || !group) return;
    const fit = Math.max(1, FRAMED_ASPECT / (state.size.width / Math.max(1, state.size.height)));

    group.rotation.y = damp(group.rotation.y, lerp(from.rotation, to.rotation, blend), 6, delta);
    explode.current = damp(explode.current, lerp(from.explode, to.explode, blend), 6, delta);

    lookTarget.current.set(
      lerp(from.lookAt[0], to.lookAt[0], blend),
      lerp(from.lookAt[1], to.lookAt[1], blend),
      lerp(from.lookAt[2], to.lookAt[2], blend)
    );
    const target = lookTarget.current;
    cam.position.set(
      damp(cam.position.x, target.x + (lerp(from.camera[0], to.camera[0], blend) - target.x) * fit, 5, delta),
      damp(cam.position.y, target.y + (lerp(from.camera[1], to.camera[1], blend) - target.y) * fit, 5, delta),
      damp(cam.position.z, target.z + (lerp(from.camera[2], to.camera[2], blend) - target.z) * fit, 5, delta)
    );
    lookAt.current.lerp(lookTarget.current, 1 - Math.exp(-delta * 5));
    cam.lookAt(lookAt.current);
  });

  return (
    <>
      <PerspectiveCamera ref={camera} makeDefault position={ANATOMY_KEYFRAMES[0].camera} fov={30} />
      <StudioLighting rimColor={secondaryHex} shadowY={-0.5} />
      <group ref={turntable}>
        <Suspense fallback={null}>
          <CapModel primaryHex={primaryHex} secondaryHex={secondaryHex} explode={() => explode.current} />
        </Suspense>
      </group>
    </>
  );
}

/** The anatomy section's slot in the shared canvas */
export default function AnatomyCapView({
  className,
  ...sceneProps
}: {
  className?: string;
  progress: MotionValue<number>;
  primaryHex: string;
  secondaryHex: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useViewVisibility(ref);

  return (
    <View ref={ref as never} className={className} visible={inView}>
      <AnatomyScene {...sceneProps} />
    </View>
  );
}
