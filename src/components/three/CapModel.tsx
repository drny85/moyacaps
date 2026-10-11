"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAP_MODEL_URL, CAP_PARTS, EXPLODE_OFFSET, PART_ROLE, getCapModelSource, type CapPart } from "./capModelConfig";
import { GltfCap } from "./GltfCap";
import { StandInCap } from "./StandInCap";

type TintedMaterial = THREE.Material & { color: THREE.Color };

interface PartHandle {
  node: THREE.Object3D;
  base: THREE.Vector3;
  offset: THREE.Vector3;
  role: (typeof PART_ROLE)[CapPart];
  materials: TintedMaterial[];
}

/** Colorway → per-role target colors */
function useTargetColors(primaryHex: string, secondaryHex: string) {
  return useMemo(() => {
    const primary = new THREE.Color(primaryHex);
    return {
      primary,
      underside: primary.clone().multiplyScalar(0.55),
      accent: new THREE.Color(secondaryHex),
    };
  }, [primaryHex, secondaryHex]);
}

/**
 * The 0880 cap, tinted to a colorway and optionally exploded into parts.
 * Swapping colorways lerps every part's material color, so all colorways
 * share one model instead of needing per-colorway assets.
 */
export function CapModel({
  primaryHex,
  secondaryHex,
  explode,
  onReady,
}: {
  primaryHex: string;
  secondaryHex: string;
  /** Read every frame; 0 = assembled, 1 = fully exploded */
  explode?: () => number;
  onReady?: () => void;
}) {
  const source = getCapModelSource();
  const parts = useRef<PartHandle[]>([]);
  const targets = useTargetColors(primaryHex, secondaryHex);
  const snapColors = useRef(true);
  // Keep collectParts stable so parts are collected once per model load.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const collectParts = useCallback(
    (root: THREE.Object3D, unitScale: number) => {
      const found: PartHandle[] = [];
      for (const name of CAP_PARTS) {
        const node = root.getObjectByName(name);
        if (!node) continue;
        const materials: TintedMaterial[] = [];
        node.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          // Own a material copy per part so tints never bleed between parts.
          const cloneOne = (m: THREE.Material) => {
            const copy = m.clone() as TintedMaterial;
            if (copy.color) materials.push(copy);
            return copy;
          };
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneOne) : cloneOne(mesh.material);
        });
        found.push({
          node,
          base: node.position.clone(),
          offset: new THREE.Vector3(...EXPLODE_OFFSET[name]).multiplyScalar(unitScale),
          role: PART_ROLE[name],
          materials,
        });
      }
      parts.current = found;
      snapColors.current = true;
      onReadyRef.current?.();
    },
    []
  );

  useEffect(() => {
    return () => {
      for (const part of parts.current) part.materials.forEach((m) => m.dispose());
    };
  }, []);

  useFrame((_, delta) => {
    const blend = snapColors.current ? 1 : 1 - Math.exp(-delta * 6);
    snapColors.current = false;
    const amount = explode ? explode() : 0;
    for (const part of parts.current) {
      const target = targets[part.role];
      for (const material of part.materials) material.color.lerp(target, blend);
      part.node.position.copy(part.base).addScaledVector(part.offset, amount);
    }
  });

  if (source === "gltf") return <GltfCap url={CAP_MODEL_URL} onReady={collectParts} />;
  if (source === "standin") return <StandInCap onReady={collectParts} />;
  return null;
}
