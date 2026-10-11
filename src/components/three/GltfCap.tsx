"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/** Target crown width in normalized model space (matches the stand-in) */
const NORMALIZED_WIDTH = 2;

/**
 * Loads the production cap GLB and normalizes it into the shared model space:
 * crown width 2, base on y = 0, centered on X/Z. The modeler exports the
 * front of the cap facing +Z with parts named per CAP_PARTS.
 */
export function GltfCap({
  url,
  onReady,
}: {
  url: string;
  onReady: (root: THREE.Object3D, unitScale: number) => void;
}) {
  const { scene } = useGLTF(url);
  const root = useRef<THREE.Group>(null);

  const { model, scale, offset } = useMemo(() => {
    const model = scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = size.x > 0 ? NORMALIZED_WIDTH / size.x : 1;
    return { model, scale, offset: new THREE.Vector3(-center.x, -box.min.y, -center.z) };
  }, [scene]);

  useLayoutEffect(() => {
    // Part offsets are authored in normalized space; parts live in GLB space.
    if (root.current) onReady(root.current, 1 / scale);
  }, [onReady, scale]);

  return (
    <group scale={scale}>
      <group ref={root} position={offset}>
        <primitive object={model} />
      </group>
    </group>
  );
}
