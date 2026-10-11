"use client";

import { Suspense, useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import * as THREE from "three";
import { CapModel } from "./CapModel";
import { StudioLighting } from "./StudioLighting";
import { useStageStore } from "./stageStore";
import { useViewVisibility } from "./useViewVisibility";

export interface HeroDragState {
  /** Accumulated drag rotation in radians */
  rotation: number;
  dragging: boolean;
}

/** Resting 3/4 pose: shows the front puff and the right devil flank */
const BASE_ROTATION = -0.55;
/** Recenters the crown + visor footprint under the camera */
const MODEL_CENTER_Z = -0.42;

const { damp, lerp } = THREE.MathUtils;

function HeroScene({
  primaryHex,
  secondaryHex,
  drag,
  reduceMotion,
}: {
  primaryHex: string;
  secondaryHex: string;
  drag: MutableRefObject<HeroDragState>;
  reduceMotion: boolean;
}) {
  const turntable = useRef<THREE.Group>(null);
  const sweepLight = useRef<THREE.PointLight>(null);
  const sweepProgress = useRef(1);
  const isFirstColor = useRef(true);
  const intro = useRef({ y: reduceMotion ? 0 : 1.8, velocity: 0, spin: reduceMotion ? 0 : -Math.PI * 1.5 });
  const setHeroReady = useStageStore((s) => s.setHeroReady);

  // Light sweep across the crown on every colorway swap (not on first paint).
  useEffect(() => {
    if (isFirstColor.current) {
      isFirstColor.current = false;
      return;
    }
    if (!reduceMotion) sweepProgress.current = 0;
  }, [primaryHex, secondaryHex, reduceMotion]);

  useEffect(() => () => setHeroReady(false), [setHeroReady]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const group = turntable.current;
    if (!group) return;

    // Drop-in: slightly underdamped spring so the cap lands with a small settle.
    const s = intro.current;
    s.velocity += (-140 * s.y - 15 * s.velocity) * delta;
    s.y += s.velocity * delta;
    s.spin = damp(s.spin, 0, 2.6, delta);

    const sway = reduceMotion || drag.current.dragging ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.18;
    const target = BASE_ROTATION + s.spin + drag.current.rotation + sway;
    group.rotation.y = damp(group.rotation.y, target, 8, delta);
    group.position.y = s.y;

    const light = sweepLight.current;
    if (light) {
      if (sweepProgress.current < 1) {
        sweepProgress.current = Math.min(1, sweepProgress.current + delta / 0.9);
        light.position.x = lerp(-3, 3, sweepProgress.current);
        light.intensity = Math.sin(Math.PI * sweepProgress.current) * 30;
      } else {
        light.intensity = 0;
      }
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.15, 5.4]} fov={30} onUpdate={(c) => c.lookAt(0, 0.35, 0)} />
      <StudioLighting rimColor={secondaryHex} />
      <pointLight ref={sweepLight} position={[-3, 1.4, 2]} intensity={0} distance={7} color="#ffffff" />
      <group ref={turntable}>
        <group position={[0, 0, MODEL_CENTER_Z]}>
          <Suspense fallback={null}>
            <CapModel primaryHex={primaryHex} secondaryHex={secondaryHex} onReady={() => setHeroReady(true)} />
          </Suspense>
        </group>
      </group>
    </>
  );
}

/** The hero's slot in the shared canvas — a DOM box the cap renders into */
export default function HeroCapView({
  className,
  ...sceneProps
}: {
  className?: string;
  primaryHex: string;
  secondaryHex: string;
  drag: MutableRefObject<HeroDragState>;
  reduceMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useViewVisibility(ref);

  return (
    <View ref={ref as never} className={className} visible={inView}>
      <HeroScene {...sceneProps} />
    </View>
  );
}
