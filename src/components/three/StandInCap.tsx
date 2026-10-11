"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Procedural stand-in for the 0880 cap, used in development until the real
 * GLB is supplied. It exposes the same named part nodes as the production
 * model (see CAP_PARTS) so tinting and the exploded view work identically.
 *
 * Space: crown radius 1, crown base on y = 0, front of the cap facing +Z.
 */

const VISOR_HALF_ANGLE = (80 * Math.PI) / 180;
const VISOR_REACH = 0.85;
const VISOR_THICKNESS = 0.035;
const CROWN_HEIGHT = 0.92;

function buildVisorShape() {
  const shape = new THREE.Shape();
  const steps = 48;
  // Inner edge hugs the crown circle, outer edge sweeps forward into the bill.
  for (let i = 0; i <= steps; i++) {
    const a = -VISOR_HALF_ANGLE + (2 * VISOR_HALF_ANGLE * i) / steps;
    const x = Math.sin(a);
    const z = Math.cos(a);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  for (let i = steps; i >= 0; i--) {
    const a = -VISOR_HALF_ANGLE + (2 * VISOR_HALF_ANGLE * i) / steps;
    const reach = VISOR_REACH * Math.cos((a / VISOR_HALF_ANGLE) * (Math.PI / 2));
    shape.lineTo(Math.sin(a) * (1 + reach * 0.15), Math.cos(a) * (1 + reach));
  }
  return shape;
}

/** Point on the crown dome surface along a unit direction, plus the outward rotation */
function surfacePose(dir: THREE.Vector3, lift = 0.015) {
  const n = dir.clone().normalize();
  const position = new THREE.Vector3(n.x, n.y * CROWN_HEIGHT, n.z).multiplyScalar(1 + lift);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return { position, quaternion };
}

export function StandInCap({ onReady }: { onReady: (root: THREE.Object3D, unitScale: number) => void }) {
  const root = useRef<THREE.Group>(null);

  const assets = useMemo(() => {
    const fabric = new THREE.MeshPhysicalMaterial({
      color: "#111111",
      roughness: 0.9,
      sheen: 0.35,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#9a9a9a"),
      side: THREE.DoubleSide,
    });
    const puff = new THREE.MeshStandardMaterial({ color: "#ef4444", roughness: 0.55 });
    const underside = new THREE.MeshStandardMaterial({ color: "#0b0b0b", roughness: 0.95 });

    const visorShape = buildVisorShape();
    const visor = new THREE.ExtrudeGeometry(visorShape, {
      depth: VISOR_THICKNESS,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.012,
      bevelSegments: 3,
      curveSegments: 48,
    });
    const undervisor = new THREE.ShapeGeometry(visorShape, 48);
    const crown = new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);

    return {
      fabric,
      puff,
      underside,
      visor,
      undervisor,
      crown,
      front: surfacePose(new THREE.Vector3(0, 0.62, 0.8)),
      left: surfacePose(new THREE.Vector3(-0.92, 0.38, 0.05)),
      right: surfacePose(new THREE.Vector3(0.92, 0.38, 0.05)),
      back: surfacePose(new THREE.Vector3(0, 0.55, -0.84)),
    };
  }, []);

  useLayoutEffect(() => {
    if (root.current) onReady(root.current, 1);
  }, [onReady]);

  const { fabric, puff, underside } = assets;

  return (
    <group ref={root}>
      <mesh name="Crown" geometry={assets.crown} material={fabric} scale={[1, CROWN_HEIGHT, 1]} />

      <group name="Visor" position={[0, 0.03, 0]} rotation={[Math.PI / 2 + 0.06, 0, 0]}>
        <mesh geometry={assets.visor} material={fabric} />
      </group>

      <group name="Undervisor" position={[0, 0.03, 0]} rotation={[Math.PI / 2 + 0.06, 0, 0]}>
        <mesh geometry={assets.undervisor} material={underside} position={[0, 0, VISOR_THICKNESS + 0.012]} />
      </group>

      <mesh name="Button" material={fabric} position={[0, CROWN_HEIGHT + 0.01, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.075, 24, 16]} />
      </mesh>

      <group name="Strap" position={[0, 0.12, -0.99]}>
        <mesh material={fabric}>
          <boxGeometry args={[0.6, 0.09, 0.04]} />
        </mesh>
        {[-0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21].map((x) => (
          <mesh key={x} material={underside} position={[x, 0, -0.022]}>
            <cylinderGeometry args={[0.014, 0.014, 0.01, 12]} />
          </mesh>
        ))}
      </group>

      {/* Front: upright horseshoe catching luck + four-leaf clover, raised puff */}
      <group name="Embroidery_Front" position={assets.front.position} quaternion={assets.front.quaternion}>
        <mesh material={puff} rotation={[0, 0, -1.175 * Math.PI]}>
          <torusGeometry args={[0.22, 0.045, 16, 64, 1.35 * Math.PI]} />
        </mesh>
        {[
          [0, 0.07],
          [0, -0.07],
          [0.07, 0],
          [-0.07, 0],
        ].map(([x, y]) => (
          <mesh key={`${x}${y}`} material={puff} position={[x, y - 0.02, 0]} scale={[1, 1, 0.5]}>
            <sphereGeometry args={[0.055, 20, 14]} />
          </mesh>
        ))}
      </group>

      {/* Temples: devil pitchforks */}
      {(["Embroidery_Left", "Embroidery_Right"] as const).map((name) => {
        const pose = name === "Embroidery_Left" ? assets.left : assets.right;
        return (
          <group key={name} name={name} position={pose.position} quaternion={pose.quaternion}>
            <mesh material={puff}>
              <boxGeometry args={[0.03, 0.3, 0.03]} />
            </mesh>
            <mesh material={puff} position={[0, 0.13, 0]}>
              <boxGeometry args={[0.16, 0.026, 0.03]} />
            </mesh>
            {[-0.068, 0, 0.068].map((x) => (
              <mesh key={x} material={puff} position={[x, 0.18, 0]}>
                <coneGeometry args={[0.018, 0.1, 10]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Rear: 0880 arch above the snapback */}
      <group name="Embroidery_Back" position={assets.back.position} quaternion={assets.back.quaternion}>
        {["0", "8", "8", "0"].map((glyph, i) => {
          const x = (i - 1.5) * 0.14;
          const y = -Math.abs(i - 1.5) * 0.025;
          return glyph === "0" ? (
            <mesh key={i} material={puff} position={[x, y, 0]} scale={[1, 1.45, 1]}>
              <torusGeometry args={[0.045, 0.014, 10, 32]} />
            </mesh>
          ) : (
            <group key={i} position={[x, y, 0]}>
              <mesh material={puff} position={[0, 0.034, 0]}>
                <torusGeometry args={[0.032, 0.013, 10, 32]} />
              </mesh>
              <mesh material={puff} position={[0, -0.034, 0]}>
                <torusGeometry args={[0.036, 0.013, 10, 32]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
