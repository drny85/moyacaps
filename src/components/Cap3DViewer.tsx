"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Rotate3d,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Pause,
  Play,
  Box,
  Compass,
} from "lucide-react";
import {
  CAPS_MANIFEST,
  CAP_SVG_SILHOUETTE_PATHS,
  BASE_CAP_GLB_PATH,
  getCapColorwayManifest,
  type CapAngleKey,
  type CapColorwayManifestItem,
} from "@/data/capsManifest";
import { applyCapColorwayToScene } from "@/lib/cap3dMaterials";

export interface Cap3DViewerProps {
  /** Initial or controlled colorway ID (e.g. "negro-rojo", "verde-rojo") */
  colorwayId?: string;
  /** Callback fired when the user selects one of the 12 colorways in the dock */
  onColorwayChange?: (colorwayId: string) => void;
  /** Controlled or initial cardinal angle ("front" | "right" | "back" | "left") */
  activeAngle?: CapAngleKey;
  /** Callback fired when the active cardinal angle changes */
  onAngleChange?: (angle: CapAngleKey) => void;
  /** Locale for localized labels ("en" | "es") */
  locale?: string;
  /** Whether to show the 12-colorway selector dock (default: true) */
  showColorwayDock?: boolean;
  /** Whether to start with 360° auto-rotation enabled (default: false) */
  initialAutoRotate?: boolean;
  /** Optional custom className for the outer container */
  className?: string;
  /** Optional callback when user first interacts with the 3D stage */
  onInteract?: () => void;
  /** Priority image loading for LCP when used in hero */
  priority?: boolean;
}

const ANGLE_ORDER: readonly CapAngleKey[] = [
  "front",
  "right",
  "back",
  "left",
] as const;

const ANGLE_TO_DEG: Record<CapAngleKey, number> = {
  front: 0,
  right: 90,
  back: 180,
  left: 270,
};

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function shortestAngleDiff(fromDeg: number, toDeg: number): number {
  const diff = ((toDeg - fromDeg + 540) % 360) - 180;
  return diff;
}

function degToNearestAngleKey(deg: number): CapAngleKey {
  const norm = normalizeDeg(deg);
  if (norm >= 315 || norm < 45) return "front";
  if (norm >= 45 && norm < 135) return "right";
  if (norm >= 135 && norm < 225) return "back";
  return "left";
}

/**
 * Mode B Inner WebGL .GLB Mesh Scene
 */
function GlbCapMeshScene({
  glbUrl,
  colorway,
  targetYawDeg,
  tiltXDeg,
  zoom,
  autoRotate,
}: {
  glbUrl: string;
  colorway: Omit<CapColorwayManifestItem, "id"> & { id: string };
  targetYawDeg: number;
  tiltXDeg: number;
  zoom: number;
  autoRotate: boolean;
}) {
  const gltf = useGLTF(glbUrl);
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    applyCapColorwayToScene(clonedScene, colorway);
  }, [clonedScene, colorway]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetRadY = THREE.MathUtils.degToRad(-targetYawDeg);
    const targetRadX = THREE.MathUtils.degToRad(tiltXDeg * 0.6);

    if (!autoRotate) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRadY,
        Math.min(1, delta * 8)
      );
    } else {
      groupRef.current.rotation.y -= delta * 0.85;
    }

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRadX,
      Math.min(1, delta * 8)
    );

    const targetScale = zoom;
    const currentScale = groupRef.current.scale.x;
    const nextScale = THREE.MathUtils.lerp(
      currentScale,
      targetScale,
      Math.min(1, delta * 10)
    );
    groupRef.current.scale.setScalar(nextScale);
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight
        position={[-4, 3, -2]}
        intensity={0.9}
        angle={0.5}
        penumbra={1}
        color={colorway.secondaryHex}
      />
      <Environment preset="studio" />
      <group ref={groupRef} position={[0, -0.1, 0]}>
        <primitive object={clonedScene} />
      </group>
      <ContactShadows
        position={[0, -0.75, 0]}
        opacity={0.55}
        scale={3.5}
        blur={2.4}
        far={2}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1.4}
        maxDistance={3.8}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(Math.PI * 2) / 3}
      />
    </>
  );
}

/**
 * Interactive 360° 3D Cap Viewer & Multi-Angle Customizer
 * - Mode A (Default): Immediate 3D Spatial Multi-Angle Rotator with 360° continuous drag scrub,
 *   vertical 3D perspective tilt (rotateX), depth parallax, specular embroidery lighting, SVG silhouette mask, and dynamic floor shadow.
 * - Mode B (Auto-enabled when /models/caps/base-cap.glb exists): Full WebGL .GLB Mesh Mode inside @react-three/fiber Canvas.
 */
export function Cap3DViewer({
  colorwayId,
  onColorwayChange,
  activeAngle: controlledAngle,
  onAngleChange,
  locale = "en",
  showColorwayDock = true,
  initialAutoRotate = false,
  className = "",
  onInteract,
  priority = false,
}: Cap3DViewerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const isEs = locale === "es";

  // ── Colorway state (controlled or uncontrolled) ──
  const [internalColorwayId, setInternalColorwayId] = useState<string>(
    colorwayId || CAPS_MANIFEST[0].id
  );
  useEffect(() => {
    if (colorwayId) {
      setInternalColorwayId(colorwayId);
    }
  }, [colorwayId]);

  const activeColorway = useMemo(
    () => getCapColorwayManifest(internalColorwayId),
    [internalColorwayId]
  );

  const handleSelectColorway = useCallback(
    (id: string) => {
      setInternalColorwayId(id);
      onColorwayChange?.(id);
    },
    [onColorwayChange]
  );

  // ── Continuous 360° Yaw & Perspective Tilt (rotateX) ──
  const [yawDeg, setYawDeg] = useState<number>(
    controlledAngle ? ANGLE_TO_DEG[controlledAngle] : 0
  );
  const [tiltXDeg, setTiltXDeg] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [autoRotate, setAutoRotate] = useState<boolean>(initialAutoRotate);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loadedAngles, setLoadedAngles] = useState<Record<string, boolean>>({});

  // Sync when parent passes a new controlledAngle
  useEffect(() => {
    if (!controlledAngle) return;
    const target = ANGLE_TO_DEG[controlledAngle];
    setYawDeg((prev) => prev + shortestAngleDiff(normalizeDeg(prev), target));
  }, [controlledAngle]);

  const currentCardinalAngle = useMemo(
    () => degToNearestAngleKey(yawDeg),
    [yawDeg]
  );

  // Notify parent when nearest cardinal angle changes
  const prevCardinalRef = useRef<CapAngleKey>(currentCardinalAngle);
  useEffect(() => {
    if (prevCardinalRef.current !== currentCardinalAngle) {
      prevCardinalRef.current = currentCardinalAngle;
      onAngleChange?.(currentCardinalAngle);
    }
  }, [currentCardinalAngle, onAngleChange]);

  // ── Auto-detect whether /models/caps/base-cap.glb exists for Mode B ──
  const [glbAvailable, setGlbAvailable] = useState<boolean>(false);
  const [renderMode, setRenderMode] = useState<"spatial" | "glb">("spatial");

  useEffect(() => {
    let cancelled = false;
    fetch(BASE_CAP_GLB_PATH, { method: "HEAD" })
      .then((res) => {
        if (!cancelled && res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) {
            setGlbAvailable(true);
            setRenderMode("glb");
          }
        }
      })
      .catch(() => {
        // Mode A remains active when no .glb file is present
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Smooth spring motion values for Mode A 3D Spatial Stage ──
  const yawMotion = useMotionValue(yawDeg);
  const tiltXMotion = useMotionValue(tiltXDeg);
  const zoomMotion = useMotionValue(zoom);

  useEffect(() => {
    yawMotion.set(yawDeg);
  }, [yawDeg, yawMotion]);

  useEffect(() => {
    tiltXMotion.set(tiltXDeg);
  }, [tiltXDeg, tiltXMotion]);

  useEffect(() => {
    zoomMotion.set(zoom);
  }, [zoom, zoomMotion]);

  const smoothTiltX = useSpring(tiltXMotion, {
    stiffness: 220,
    damping: 24,
    mass: 0.7,
  });
  const smoothZoom = useSpring(zoomMotion, {
    stiffness: 240,
    damping: 26,
    mass: 0.8,
  });

  // Pointer coordinates for specular embroidery highlight & depth parallax
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const smoothPointerX = useSpring(pointerX, { stiffness: 180, damping: 22 });
  const smoothPointerY = useSpring(pointerY, { stiffness: 180, damping: 22 });

  const sheenX = useTransform(smoothPointerX, (v) => `${(v * 100).toFixed(1)}%`);
  const sheenY = useTransform(smoothPointerY, (v) => `${(v * 100).toFixed(1)}%`);
  const specularGradient = useMotionTemplate`radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 28%, transparent 58%)`;

  const shadowOffsetX = useTransform(smoothPointerX, [0, 1], ["5%", "-5%"]);
  const shadowScale = useTransform(
    smoothZoom,
    [0.85, 1, 1.65],
    [0.88, 1, 1.18]
  );

  // ── 360° Auto-Rotate Loop ──
  useEffect(() => {
    if (!autoRotate || isDragging || reduceMotion) return;
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setYawDeg((prev) => prev + dt * 38); // 38° per second smooth 360° turntable spin
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoRotate, isDragging, reduceMotion]);

  // ── Pointer Drag Scrubbing (Horizontal = 360° Yaw, Vertical = 3D rotateX Tilt) ──
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startYaw: number;
    startTilt: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (renderMode === "glb") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setAutoRotate(false);
    onInteract?.();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startYaw: yawDeg,
      startTilt: tiltXDeg,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    pointerX.set(nx);
    pointerY.set(ny);

    if (!dragStateRef.current) {
      if (!reduceMotion && e.pointerType === "mouse") {
        setTiltXDeg((0.5 - ny) * 14);
      }
      return;
    }

    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;

    // Dragging horizontally scrubs smoothly 360° through Front (0°) -> Right (90°) -> Back (180°) -> Left (270°)
    const sensitivity = 360 / Math.max(260, rect.width * 0.72);
    setYawDeg(dragStateRef.current.startYaw + dx * sensitivity);

    // Dragging vertically applies subtle 3D perspective tilt (rotateX)
    const nextTilt = Math.max(
      -18,
      Math.min(18, dragStateRef.current.startTilt - dy * 0.12)
    );
    setTiltXDeg(nextTilt);
  };

  const handlePointerUp = () => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    setTiltXDeg(0);
  };

  const handlePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
    if (!dragStateRef.current) {
      setTiltXDeg(0);
    }
  };

  // ── Quick-Angle Camera Snap ──
  const snapToAngle = useCallback(
    (angle: CapAngleKey) => {
      setAutoRotate(false);
      onInteract?.();
      const targetDeg = ANGLE_TO_DEG[angle];
      setYawDeg((prev) => prev + shortestAngleDiff(normalizeDeg(prev), targetDeg));
      onAngleChange?.(angle);
    },
    [onAngleChange, onInteract]
  );

  // ── Zoom Controls ──
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(1.65, Number((z + 0.2).toFixed(2))));
    onInteract?.();
  }, [onInteract]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.85, Number((z - 0.2).toFixed(2))));
    onInteract?.();
  }, [onInteract]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setTiltXDeg(0);
    snapToAngle("front");
  }, [snapToAngle]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setAutoRotate(false);
      setYawDeg((prev) => prev + 45);
      onInteract?.();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setAutoRotate(false);
      setYawDeg((prev) => prev - 45);
      onInteract?.();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleZoomIn();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleZoomOut();
    }
  };

  const angleLabels: Record<CapAngleKey, { short: string; badge: string }> = {
    front: {
      short: isEs ? "Frente" : "Front",
      badge: isEs
        ? "0° Frente • Bordado 3D Good Luck!!!"
        : "0° Front • Good Luck!!! 3D Puff Embroidery",
    },
    right: {
      short: isEs ? "Lado Der." : "Right Side",
      badge: isEs
        ? "90° Perfil Derecho • Parche Diablo"
        : "90° Right Profile • Devil Pitchfork Patch",
    },
    back: {
      short: isEs ? "Atrás (0880)" : "Back (0880)",
      badge: isEs
        ? "180° Parte Trasera • Bordado 0880 & Snapback"
        : "180° Rear View • 0880 Red Embroidery & Snapback",
    },
    left: {
      short: isEs ? "Lado Izq." : "Left Side",
      badge: isEs
        ? "270° Perfil Izquierdo • Parche Diablo"
        : "270° Left Profile • Devil Pitchfork Patch",
    },
  };

  // Compute spatial blending weights and 3D transforms for the 4 cardinal planes in Mode A
  const normalizedYaw = normalizeDeg(yawDeg);
  const currentImgKey = `${activeColorway.id}:${currentCardinalAngle}`;
  const isCurrentLoaded = Boolean(loadedAngles[currentImgKey]);

  return (
    <div className={`flex flex-col gap-3 select-none ${className}`}>
      {/* ── Main 360° 3D Stage ── */}
      <div
        role="region"
        aria-label={
          isEs
            ? `Visor 3D 360° — ${activeColorway.nameEs}`
            : `360° 3D Cap Viewer — ${activeColorway.nameEn}`
        }
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className={`relative aspect-square w-full overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-b from-zinc-100/80 via-white/40 to-zinc-200/60 dark:from-zinc-900/80 dark:via-zinc-950/60 dark:to-black/80 shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red/60 ${
          renderMode === "spatial"
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab touch-pan-y"
            : "cursor-grab"
        }`}
      >
        {/* Subtle Studio Blueprint Grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 blueprint-grid opacity-15 dark:opacity-20"
        />

        {/* Ambient Colorway Studio Backlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[12%] top-[14%] h-[58%] rounded-full blur-[90px] opacity-35 transition-colors duration-700"
          style={{
            background: `radial-gradient(circle, ${activeColorway.primaryHex} 0%, ${activeColorway.secondaryHex} 70%, transparent 100%)`,
          }}
        />

        {/* Top Bar: Active Angle Compass Badge + Mode / Zoom Controls */}
        <div className="absolute top-3.5 inset-x-3.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 backdrop-blur-md shadow-sm">
            <Compass className="w-3.5 h-3.5 text-moya-red shrink-0" />
            <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-zinc-800 dark:text-zinc-200">
              {Math.round(normalizedYaw)}°
            </span>
            <span className="hidden sm:inline text-[11px] font-display font-medium text-zinc-500 dark:text-zinc-400">
              {angleLabels[currentCardinalAngle].short}
            </span>
            {activeColorway.isTruckerMesh && (
              <span className="rounded-full bg-moya-red/15 px-2 py-0.5 text-[9px] font-mono font-bold uppercase text-moya-red">
                Trucker Mesh
              </span>
            )}
          </div>

          {/* Right Top Controls: Zoom In / Out / Reset + Optional GLB Mode Switch */}
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-1 backdrop-blur-md shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {glbAvailable && (
              <button
                type="button"
                onClick={() =>
                  setRenderMode((m) => (m === "glb" ? "spatial" : "glb"))
                }
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition-colors ${
                  renderMode === "glb"
                    ? "bg-moya-red text-white"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                title={
                  renderMode === "glb"
                    ? "WebGL .GLB Mesh Active"
                    : "Switch to WebGL .GLB Mesh"
                }
              >
                <Box className="w-3 h-3" />
                <span>GLB</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.85}
              aria-label={isEs ? "Alejar zoom" : "Zoom out"}
              title={isEs ? "Alejar zoom" : "Zoom out"}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300 min-w-[36px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 1.65}
              aria-label={isEs ? "Acercar zoom a bordado 3D" : "Zoom in to 3D embroidery"}
              title={isEs ? "Acercar zoom a bordado 3D" : "Zoom in to 3D embroidery"}
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {(zoom !== 1 || normalizedYaw !== 0) && (
              <button
                type="button"
                onClick={handleResetView}
                aria-label={isEs ? "Restablecer vista" : "Reset view"}
                title={isEs ? "Restablecer vista" : "Reset view"}
                className="p-1.5 rounded-full text-zinc-500 hover:text-moya-red hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── MODE B: Full WebGL .GLB Mesh Mode (Auto-enabled when /models/caps/base-cap.glb exists) ── */}
        {renderMode === "glb" && glbAvailable ? (
          <div className="absolute inset-0">
            <Canvas
              shadows
              camera={{ position: [0, 0, 2.5], fov: 45 }}
              gl={{ antialias: true, alpha: true }}
            >
              <Suspense fallback={null}>
                <GlbCapMeshScene
                  glbUrl={BASE_CAP_GLB_PATH}
                  colorway={activeColorway}
                  targetYawDeg={yawDeg}
                  tiltXDeg={tiltXDeg}
                  zoom={zoom}
                  autoRotate={autoRotate}
                />
              </Suspense>
            </Canvas>
          </div>
        ) : (
          /* ── MODE A: Immediate 3D Spatial Multi-Angle Rotator ── */
          <div className="relative h-full w-full [perspective:1200px]">
            {/* Dynamic 3D Floor Contact Shadow */}
            <motion.div
              aria-hidden
              style={{ x: shadowOffsetX, scale: shadowScale }}
              className="pointer-events-none absolute inset-x-[16%] bottom-[8%] h-[8%] rounded-[50%] bg-black/40 dark:bg-black/75 blur-xl"
            />
            <motion.div
              aria-hidden
              style={{ x: shadowOffsetX, scale: shadowScale }}
              className="pointer-events-none absolute inset-x-[24%] bottom-[7%] h-[5%] rounded-[50%] blur-2xl opacity-45 transition-colors duration-500"
              style-color={activeColorway.secondaryHex}
            />

            {/* Crisp SVG Silhouette Loading / Hit-Area Contour */}
            <svg
              aria-hidden
              viewBox="0 0 1024 1024"
              className={`pointer-events-none absolute inset-[4%] h-[92%] w-[92%] transition-opacity duration-300 ${
                isCurrentLoaded ? "opacity-0" : "opacity-25 animate-pulse"
              }`}
            >
              <path
                d={CAP_SVG_SILHOUETTE_PATHS[currentCardinalAngle]}
                fill={activeColorway.primaryHex}
                stroke={activeColorway.secondaryHex}
                strokeWidth="6"
              />
            </svg>

            {/* 3D Perspective Stage Container */}
            <motion.div
              style={{
                rotateX: smoothTiltX,
                scale: smoothZoom,
              }}
              className="relative h-full w-full [transform-style:preserve-3d]"
            >
              {ANGLE_ORDER.map((angleKey) => {
                const planeDeg = ANGLE_TO_DEG[angleKey];
                const diff = shortestAngleDiff(normalizedYaw, planeDeg);
                const absDiff = Math.abs(diff);

                // Smooth visibility window: each cardinal view cross-rotates over [-90°..+90°]
                const isVisible = absDiff < 90;
                const progress = Math.max(-1, Math.min(1, diff / 90));
                const opacity = isVisible
                  ? Math.pow(Math.cos((progress * Math.PI) / 2), 1.6)
                  : 0;
                const rotateYPlane = -progress * 48;
                const translateXPercent = -progress * 18;
                const translateZPx = (1 - Math.abs(progress)) * 30 - 15;
                const planeScale = 1 - Math.abs(progress) * 0.08;

                const imgSrc = activeColorway.angles[angleKey];
                const loadKey = `${activeColorway.id}:${angleKey}`;

                return (
                  <div
                    key={angleKey}
                    aria-hidden={angleKey !== currentCardinalAngle}
                    style={{
                      opacity,
                      transform: `translate3d(${translateXPercent}%, 0px, ${translateZPx}px) rotateY(${rotateYPlane}deg) scale(${planeScale})`,
                      pointerEvents:
                        angleKey === currentCardinalAngle ? "auto" : "none",
                      zIndex: angleKey === currentCardinalAngle ? 10 : 5,
                    }}
                    className="absolute inset-[4%] transition-none will-change-transform"
                  >
                    <Image
                      src={imgSrc}
                      alt={`${
                        isEs ? activeColorway.nameEs : activeColorway.nameEn
                      } — ${angleLabels[angleKey].short}`}
                      fill
                      priority={priority && angleKey === "front"}
                      unoptimized
                      draggable={false}
                      sizes="(max-width: 1024px) 92vw, 680px"
                      onLoad={() =>
                        setLoadedAngles((prev) =>
                          prev[loadKey] ? prev : { ...prev, [loadKey]: true }
                        )
                      }
                      className="object-contain drop-shadow-[0_22px_38px_rgba(0,0,0,0.32)] dark:drop-shadow-[0_25px_48px_rgba(0,0,0,0.82)] select-none"
                    />
                  </div>
                );
              })}

              {/* Specular Embroidery Lighting Highlight */}
              {!reduceMotion && (
                <motion.div
                  aria-hidden
                  style={{ background: specularGradient }}
                  className="pointer-events-none absolute inset-[8%] z-20 rounded-[36%] mix-blend-soft-light"
                />
              )}
            </motion.div>
          </div>
        )}

        {/* Bottom Stage Overlay: Drag 360° Hint & Active Angle Description */}
        <div className="pointer-events-none absolute bottom-3.5 inset-x-3.5 z-20 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 px-3 py-1 text-[11px] font-display font-medium text-zinc-700 dark:text-zinc-300 backdrop-blur-md shadow-sm">
            <Sparkles className="w-3 h-3 text-moya-red shrink-0" />
            <span className="truncate max-w-[230px] sm:max-w-xs">
              {angleLabels[currentCardinalAngle].badge}
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/75 dark:bg-zinc-900/75 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 backdrop-blur-md">
            <Rotate3d className="w-3 h-3 text-moya-red" />
            <span>{isEs ? "Arrastra 360°" : "Drag 360°"}</span>
          </div>
        </div>
      </div>

      {/* ── Step 4: Interactive Customizer Control Bar ── */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-zinc-900/70 p-3 backdrop-blur-xl shadow-lg">
        {/* Quick-Angle Camera Buttons + Auto-Rotate 360° Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-[240px]">
            {ANGLE_ORDER.map((angleKey) => {
              const isSelected =
                !autoRotate && currentCardinalAngle === angleKey;
              return (
                <button
                  key={angleKey}
                  type="button"
                  onClick={() => snapToAngle(angleKey)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-display font-semibold transition-all ${
                    isSelected
                      ? "bg-moya-red text-white shadow-md shadow-moya-red/25"
                      : "bg-black/[0.04] dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                  }`}
                >
                  <span className="truncate">
                    {angleLabels[angleKey].short}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setAutoRotate((r) => !r);
              onInteract?.();
            }}
            aria-pressed={autoRotate}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-display font-bold transition-all ${
              autoRotate
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                : "border border-moya-red/30 bg-moya-red/10 text-moya-red hover:bg-moya-red/20"
            }`}
          >
            {autoRotate ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isEs ? "Giro 360°" : "Auto-Rotate 360°"}</span>
          </button>
        </div>

        {/* 12-Colorway Selector Dock */}
        {showColorwayDock && (
          <div className="pt-1.5 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {isEs
                  ? `Selector de Colorway (${CAPS_MANIFEST.length})`
                  : `Colorway Selector Dock (${CAPS_MANIFEST.length})`}
              </span>
              <span className="text-xs font-display font-semibold text-zinc-900 dark:text-white truncate">
                {isEs ? activeColorway.nameEs : activeColorway.nameEn}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label={isEs ? "Seleccionar Colorway" : "Select Colorway"}
              className="grid grid-cols-6 sm:grid-cols-12 gap-2"
            >
              {CAPS_MANIFEST.map((cw) => {
                const isSelected = cw.id === activeColorway.id;
                const label = isEs ? cw.nameEs : cw.nameEn;
                return (
                  <button
                    key={cw.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={label}
                    title={label}
                    onClick={() => handleSelectColorway(cw.id)}
                    className={`group relative aspect-square w-full max-w-[36px] mx-auto rounded-full p-0.5 transition-transform ${
                      isSelected
                        ? "scale-110 ring-2 ring-moya-red ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
                        : "hover:scale-105 opacity-85 hover:opacity-100"
                    }`}
                  >
                    <span
                      className="block h-full w-full rounded-full border border-black/15 dark:border-white/20 shadow-inner"
                      style={{
                        background: cw.camoPattern
                          ? `repeating-linear-gradient(45deg, ${cw.primaryHex} 0px, ${cw.primaryHex} 5px, ${cw.secondaryHex} 5px, ${cw.secondaryHex} 10px)`
                          : `linear-gradient(135deg, ${cw.primaryHex} 55%, ${cw.secondaryHex} 45%)`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default Cap3DViewer;
