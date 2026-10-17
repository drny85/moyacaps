import * as THREE from "three";
import type { CapColorwayManifestItem } from "@/data/capsManifest";

export type CapColorwayConfig = Omit<
  Pick<
    CapColorwayManifestItem,
    | "id"
    | "primaryHex"
    | "secondaryHex"
    | "isTruckerMesh"
    | "camoPattern"
    | "angles"
  >,
  "id"
> & { id: string };

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCamoCanvasTexture(
  pattern: "woodland" | "urban"
): THREE.CanvasTexture {
  const key = `camo:${pattern}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x * 0.032;
      const sy = y * 0.032;
      const v1 =
        Math.sin(sx * 1.7 + Math.cos(sy * 1.9) * 1.5) +
        Math.cos(sy * 1.4 - Math.sin(sx * 1.3) * 1.5);
      const v2 =
        Math.sin(sx * 3.7 + sy * 2.3) * 0.5 +
        Math.cos(sx * 2.9 - sy * 4.1) * 0.5;
      const n = (v1 + v2 + 3) / 6;
      const twill = Math.sin((x + y) * 1.4) * 6;

      let r = 30;
      let g = 30;
      let b = 30;
      if (pattern === "woodland") {
        if (n < 0.36) {
          r = 28;
          g = 34;
          b = 24;
        } else if (n < 0.56) {
          r = 65;
          g = 82;
          b = 48;
        } else if (n < 0.74) {
          r = 96;
          g = 74;
          b = 49;
        } else {
          r = 136;
          g = 122;
          b = 86;
        }
      } else {
        if (n < 0.38) {
          r = 24;
          g = 26;
          b = 30;
        } else if (n < 0.62) {
          r = 58;
          g = 63;
          b = 72;
        } else if (n < 0.8) {
          r = 92;
          g = 98;
          b = 108;
        } else {
          r = 38;
          g = 42;
          b = 48;
        }
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, r + twill));
      data[idx + 1] = Math.max(0, Math.min(255, g + twill));
      data[idx + 2] = Math.max(0, Math.min(255, b + twill));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

function createTruckerMeshTexture(hex: string): THREE.CanvasTexture {
  const key = `mesh:${hex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);

  // Diamond trucker mesh perforations
  ctx.globalCompositeOperation = "destination-out";
  const step = 16;
  for (let y = 0; y < size + step; y += step / 2) {
    const offset = (y / (step / 2)) % 2 === 0 ? 0 : step / 2;
    for (let x = offset; x < size + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "source-over";

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Dynamically updates materials and textures on a loaded Three.js GLTF/GLB cap scene
 * to reflect any of the 12+ cap colorways (solid cotton twill, woodland/urban camo, or trucker mesh).
 */
export function applyCapColorwayToScene(
  root: THREE.Object3D,
  colorway: CapColorwayConfig
): void {
  const primaryColor = new THREE.Color(colorway.primaryHex);
  const secondaryColor = new THREE.Color(colorway.secondaryHex);
  const darkMeshColor = new THREE.Color("#18181b");

  const hasDOM = typeof document !== "undefined";
  const camoMap =
    hasDOM && colorway.camoPattern
      ? createCamoCanvasTexture(colorway.camoPattern)
      : null;
  const truckerMeshMap =
    hasDOM && colorway.isTruckerMesh
      ? createTruckerMeshTexture("#18181b")
      : null;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    const nodeName = `${mesh.name} ${materials.map((m) => m.name).join(" ")}`.toLowerCase();

    for (const mat of materials) {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (!("color" in stdMat)) continue;

      // Preserve embroidery / patch / logo materials untouched
      if (
        nodeName.includes("embroidery") ||
        nodeName.includes("logo") ||
        nodeName.includes("patch") ||
        nodeName.includes("devil") ||
        nodeName.includes("clover") ||
        nodeName.includes("horseshoe") ||
        nodeName.includes("0880")
      ) {
        stdMat.roughness = 0.42;
        stdMat.metalness = 0.08;
        stdMat.needsUpdate = true;
        continue;
      }

      // Sandwich brim edge / top button / accent stitching
      if (
        nodeName.includes("sandwich") ||
        nodeName.includes("lip") ||
        nodeName.includes("accent") ||
        nodeName.includes("button") ||
        nodeName.includes("eyelet")
      ) {
        stdMat.color.copy(secondaryColor);
        stdMat.map = null;
        stdMat.roughness = 0.72;
        stdMat.metalness = 0.05;
        stdMat.needsUpdate = true;
        continue;
      }

      // Rear/side mesh panels (Trucker vs solid/camo)
      if (
        nodeName.includes("mesh") ||
        nodeName.includes("rear") ||
        nodeName.includes("back_panel") ||
        nodeName.includes("side_panel")
      ) {
        if (colorway.isTruckerMesh) {
          stdMat.color.copy(darkMeshColor);
          stdMat.map = truckerMeshMap;
          stdMat.transparent = true;
          stdMat.alphaTest = 0.25;
          stdMat.roughness = 0.65;
        } else if (camoMap) {
          stdMat.color.set("#ffffff");
          stdMat.map = camoMap;
          stdMat.transparent = false;
          stdMat.roughness = 0.85;
        } else {
          stdMat.color.copy(primaryColor);
          stdMat.map = null;
          stdMat.transparent = false;
          stdMat.roughness = 0.85;
        }
        stdMat.needsUpdate = true;
        continue;
      }

      // Visor / Brim
      if (nodeName.includes("visor") || nodeName.includes("brim")) {
        if (colorway.isTruckerMesh) {
          stdMat.color.copy(darkMeshColor);
          stdMat.map = null;
        } else if (camoMap) {
          stdMat.color.set("#ffffff");
          stdMat.map = camoMap;
        } else {
          stdMat.color.copy(primaryColor);
          stdMat.map = null;
        }
        stdMat.roughness = 0.82;
        stdMat.metalness = 0.04;
        stdMat.needsUpdate = true;
        continue;
      }

      // Default: Crown / Main Cap Body
      if (camoMap) {
        stdMat.color.set("#ffffff");
        stdMat.map = camoMap;
      } else if (!stdMat.map) {
        stdMat.color.copy(primaryColor);
      } else {
        // When a single baked texture mesh is returned by Tripo3D/Meshy, tint subtly or preserve baked map for flagship
        if (colorway.id === "negro-rojo") {
          stdMat.color.set("#ffffff");
        } else {
          stdMat.color.copy(primaryColor).lerp(new THREE.Color("#ffffff"), 0.35);
        }
      }
      stdMat.roughness = 0.84;
      stdMat.metalness = 0.04;
      stdMat.needsUpdate = true;
    }
  });
}
