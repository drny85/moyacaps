import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal-node";
import fs from "fs/promises";
import path from "path";

export type CardinalAngle = "front" | "right" | "back" | "left";

export interface ColorwaySpec {
  id: string;
  nameEn: string;
  nameEs: string;
  primaryHex: string;
  secondaryHex: string;
  isTruckerMesh: boolean;
  camoType?: "woodland" | "urban";
  gridRow: number;
  gridCol: number;
  hqSource?: string;
  isCore12: boolean;
}

const COLORWAY_SPECS: ColorwaySpec[] = [
  {
    id: "negro-rojo",
    nameEn: "Black / Red Signature",
    nameEs: "Negro / Rojo Insignia",
    primaryHex: "#111111",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 0,
    gridCol: 0,
    hqSource: "public/caps/hq2.png",
    isCore12: true,
  },
  {
    id: "verde-rojo",
    nameEn: "Forest Green / Red Shamrock",
    nameEs: "Verde Bosque / Rojo",
    primaryHex: "#14532d",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 1,
    gridCol: 0,
    hqSource: "public/caps/hq1.png",
    isCore12: true,
  },
  {
    id: "camuflaje-gris-negro",
    nameEn: "Urban Camo Shadow / Black",
    nameEs: "Camuflaje Urbano Gris / Negro",
    primaryHex: "#374151",
    secondaryHex: "#111111",
    isTruckerMesh: false,
    camoType: "urban",
    gridRow: 3,
    gridCol: 3,
    isCore12: true,
  },
  {
    id: "gris-negro-trucker",
    nameEn: "Heather Grey / Mesh Trucker",
    nameEs: "Gris / Negro (Malla Trucker)",
    primaryHex: "#6b7280",
    secondaryHex: "#111111",
    isTruckerMesh: true,
    gridRow: 3,
    gridCol: 1,
    isCore12: true,
  },
  {
    id: "camuflaje-negro",
    nameEn: "Woodland Camo / Black",
    nameEs: "Camuflaje Bosque / Negro",
    primaryHex: "#3f4733",
    secondaryHex: "#111111",
    isTruckerMesh: false,
    camoType: "woodland",
    gridRow: 3,
    gridCol: 0,
    isCore12: true,
  },
  {
    id: "blanco-negro-trucker",
    nameEn: "Two-Tone White / Black Trucker",
    nameEs: "Blanco / Negro (Malla Trucker)",
    primaryHex: "#f8fafc",
    secondaryHex: "#111111",
    isTruckerMesh: true,
    gridRow: 3,
    gridCol: 2,
    isCore12: true,
  },
  {
    id: "turquesa-blanco",
    nameEn: "Cyan Turquoise / White",
    nameEs: "Turquesa / Blanco",
    primaryHex: "#06b6d4",
    secondaryHex: "#ffffff",
    isTruckerMesh: false,
    gridRow: 2,
    gridCol: 3,
    isCore12: true,
  },
  {
    id: "rosa-blanco",
    nameEn: "Pastel Pink / White",
    nameEs: "Rosa Pastel / Blanco",
    primaryHex: "#f472b6",
    secondaryHex: "#ffffff",
    isTruckerMesh: false,
    gridRow: 2,
    gridCol: 1,
    isCore12: true,
  },
  {
    id: "azul-rey-blanco",
    nameEn: "Royal Blue / White Crisp",
    nameEs: "Azul Rey / Blanco",
    primaryHex: "#1d4ed8",
    secondaryHex: "#ffffff",
    isTruckerMesh: false,
    gridRow: 2,
    gridCol: 0,
    isCore12: true,
  },
  {
    id: "morado-blanco",
    nameEn: "Imperial Purple / White",
    nameEs: "Morado Imperial / Blanco",
    primaryHex: "#6b21a8",
    secondaryHex: "#ffffff",
    isTruckerMesh: false,
    gridRow: 2,
    gridCol: 2,
    isCore12: true,
  },
  {
    id: "marron-rojo",
    nameEn: "Chocolate Brown / Red",
    nameEs: "Marrón Chocolate / Rojo",
    primaryHex: "#451a03",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 1,
    gridCol: 3,
    isCore12: true,
  },
  {
    id: "beige-rojo",
    nameEn: "Sand Beige / Red",
    nameEs: "Beige Arena / Rojo",
    primaryHex: "#d6c7a1",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 1,
    gridCol: 2,
    isCore12: true,
  },
  // Additional 4 catalog colorways for complete catalog coverage
  {
    id: "blanco-rojo",
    nameEn: "White / Red Clean",
    nameEs: "Blanco / Rojo",
    primaryHex: "#f8fafc",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 0,
    gridCol: 1,
    isCore12: false,
  },
  {
    id: "azul-marino-rojo",
    nameEn: "Navy / Red Classic",
    nameEs: "Azul Marino / Rojo",
    primaryHex: "#1e293b",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 0,
    gridCol: 2,
    isCore12: false,
  },
  {
    id: "rojo-negro",
    nameEn: "Red / Black Devil Flare",
    nameEs: "Rojo / Negro",
    primaryHex: "#dc2626",
    secondaryHex: "#111111",
    isTruckerMesh: false,
    gridRow: 0,
    gridCol: 3,
    isCore12: false,
  },
  {
    id: "gris-rojo",
    nameEn: "Heather Grey / Red",
    nameEs: "Gris Jaspe / Rojo",
    primaryHex: "#6b7280",
    secondaryHex: "#ef4444",
    isTruckerMesh: false,
    gridRow: 1,
    gridCol: 1,
    isCore12: false,
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function camoNoise(x: number, y: number): number {
  const sx = x * 0.022;
  const sy = y * 0.022;
  const v1 =
    Math.sin(sx * 1.7 + Math.cos(sy * 1.9) * 1.5) +
    Math.cos(sy * 1.4 - Math.sin(sx * 1.3) * 1.5);
  const v2 =
    Math.sin(sx * 3.7 + sy * 2.3) * 0.5 +
    Math.cos(sx * 2.9 - sy * 4.1) * 0.5;
  return (v1 + v2 + 3) / 6;
}

/**
 * Spatial normalization onto a 1024x1024 canvas with locked crown apex and height
 * so rotating Front (0°) -> Right (90°) -> Back (180°) -> Left (270°) has zero vertical or horizontal jump.
 */
async function normalizeTo1024Canvas(
  trimmedPngBuf: Buffer,
  angle: CardinalAngle
): Promise<Buffer> {
  const trimmed = await sharp(trimmedPngBuf)
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });

  const tw = trimmed.info.width;
  const th = trimmed.info.height;

  // Target dimensions on 1024x1024 canvas so crown apex sits at y=118 across all 4 angles
  // and crown dome height is consistent across front, right, back, and left.
  let targetW: number;
  let targetH: number;
  let topY = 118;

  if (angle === "front") {
    targetH = 788;
    targetW = Math.min(920, Math.round((tw / th) * targetH));
  } else if (angle === "back") {
    // Back view has no downward-curving front visor, so its total height is the crown dome height (~710px)
    targetH = 712;
    targetW = Math.min(900, Math.round((tw / th) * targetH));
  } else {
    // Left and Right profile views include the side-projecting visor
    targetW = 916;
    targetH = Math.min(765, Math.round((th / tw) * targetW));
  }

  const resized = await sharp(trimmed.data)
    .resize(targetW, targetH, {
      fit: "contain",
      kernel: "lanczos3",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const leftX = Math.round((1024 - targetW) / 2);

  return sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: leftX, top: topY }])
    .png({ quality: 95 })
    .toBuffer();
}

/**
 * Clean a high-res cap image using @imgly/background-removal-node combined with
 * exterior flood-fill and red-brim-lip shadow stripping so interior pixels remain 100% opaque.
 */
async function cleanMasterView(
  inputBuf: Buffer,
  angle: CardinalAngle
): Promise<Buffer> {
  const meta = await sharp(inputBuf).metadata();
  const w = meta.width!;
  const h = meta.height!;

  const blob = await removeBackground(new Blob([inputBuf], { type: "image/png" }));
  const maskBuf = Buffer.from(await blob.arrayBuffer());
  const maskRaw = await sharp(maskBuf).resize(w, h).ensureAlpha().raw().toBuffer();
  const origRaw = await sharp(inputBuf).ensureAlpha().raw().toBuffer();

  // For side views, find the red sandwich brim lip on the visor half so any floor shadow under the visor is stripped
  const maxLipY = new Int16Array(w).fill(-1);
  if (angle === "left" || angle === "right") {
    const xStart = angle === "left" ? Math.floor(w * 0.56) : 0;
    const xEnd = angle === "left" ? w - 1 : Math.floor(w * 0.44);
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = Math.floor(h * 0.66); y < h; y++) {
        const i = (y * w + x) * 4;
        const r = origRaw[i];
        const g = origRaw[i + 1];
        const b = origRaw[i + 2];
        if (r > 55 && r - g >= 16 && r - b >= 16) {
          maxLipY[x] = y;
        }
      }
    }
  }

  const isBg = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = origRaw[i * 4];
      const g = origRaw[i * 4 + 1];
      const b = origRaw[i * 4 + 2];
      const a = maskRaw[i * 4 + 3];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const lum = (r + g + b) / 3;

      if (x <= 3 || x >= w - 4 || y <= 3 || y >= h - 3) {
        isBg[i] = 1;
      } else if (a < 95 && (angle === "front" || sat <= 20)) {
        isBg[i] = 1;
      } else if (sat <= 16 && lum >= 110) {
        isBg[i] = 1;
      } else if (y > h * 0.74 && sat <= 16 && lum >= 38) {
        isBg[i] = 1;
      } else if (maxLipY[x] !== -1 && y > maxLipY[x] + 1) {
        isBg[i] = 1;
      } else if (
        angle === "left" &&
        x < w * 0.56 &&
        y > h * 0.855 &&
        sat <= 16 &&
        lum >= 22
      ) {
        isBg[i] = 1;
      } else if (
        angle === "right" &&
        x > w * 0.44 &&
        y > h * 0.855 &&
        sat <= 16 &&
        lum >= 22
      ) {
        isBg[i] = 1;
      }

      if (
        angle === "back" &&
        x > w * 0.27 &&
        x < w * 0.73 &&
        y > h * 0.6 &&
        y < h * 0.83
      ) {
        if (sat <= 14 && lum >= 50) {
          isBg[i] = 1;
        }
      }
    }
  }

  // Flood fill from perimeter + back keyhole arch center
  const ext = new Uint8Array(w * h);
  const q: number[] = [];
  for (let x = 0; x < w; x++) {
    if (isBg[x]) {
      ext[x] = 1;
      q.push(x);
    }
    const bot = (h - 1) * w + x;
    if (isBg[bot]) {
      ext[bot] = 1;
      q.push(bot);
    }
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    const r = y * w + (w - 1);
    if (isBg[l] && !ext[l]) {
      ext[l] = 1;
      q.push(l);
    }
    if (isBg[r] && !ext[r]) {
      ext[r] = 1;
      q.push(r);
    }
  }
  if (angle === "back") {
    const ki = Math.floor(h * 0.73) * w + Math.floor(w * 0.5);
    if (isBg[ki] && !ext[ki]) {
      ext[ki] = 1;
      q.push(ki);
    }
  }

  let head = 0;
  while (head < q.length) {
    const curr = q[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !ext[n] && isBg[n]) {
        ext[n] = 1;
        q.push(n);
      }
    }
  }

  const out = Buffer.from(origRaw);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (ext[i]) {
        out[i * 4 + 3] = 0;
      } else {
        let adjExt = 0;
        if (x > 0 && ext[i - 1]) adjExt++;
        if (x < w - 1 && ext[i + 1]) adjExt++;
        if (y > 0 && ext[i - w]) adjExt++;
        if (y < h - 1 && ext[i + w]) adjExt++;
        if (adjExt > 0) {
          out[i * 4] = Math.round(out[i * 4] * 0.72);
          out[i * 4 + 1] = Math.round(out[i * 4 + 1] * 0.72);
          out[i * 4 + 2] = Math.round(out[i * 4 + 2] * 0.72);
          out[i * 4 + 3] = adjExt >= 2 ? 105 : 195;
        } else {
          out[i * 4 + 3] = 255;
        }
      }
    }
  }

  const rawCleaned = await sharp(out, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();

  return normalizeTo1024Canvas(rawCleaned, angle);
}

/**
 * Recolor and texture normalized master left/right/back views for each colorway
 */
async function synthesizeAngleViewForColorway(
  masterNormalizedBuf: Buffer,
  angle: "left" | "right" | "back",
  spec: ColorwaySpec
): Promise<Buffer> {
  if (spec.id === "negro-rojo") {
    return masterNormalizedBuf;
  }

  const { data, info } = await sharp(masterNormalizedBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const smoothData = await sharp(masterNormalizedBuf)
    .blur(4.0)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const w = info.width;
  const h = info.height;
  const out = Buffer.from(data);
  const [pR, pG, pB] = hexToRgb(spec.primaryHex);
  const [sR, sG, sB] = hexToRgb(spec.secondaryHex);

  const isEmbCore = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      if (data[i + 3] < 20) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isBrimLipRegion =
        (angle === "left" || angle === "right") &&
        y > h * 0.7 &&
        ((angle === "left" && x > w * 0.52) ||
          (angle === "right" && x < w * 0.48));

      if (!isBrimLipRegion) {
        const isRed = r > 55 && r - g > 20;
        const isGreen = g > 55 && g - r > 15;
        const inDevilBox =
          (angle === "left" &&
            x > w * 0.14 &&
            x < w * 0.6 &&
            y > h * 0.3 &&
            y < h * 0.74) ||
          (angle === "right" &&
            x > w * 0.4 &&
            x < w * 0.86 &&
            y > h * 0.3 &&
            y < h * 0.74);
        const isDevilWhite = inDevilBox && r > 90 && g > 90 && b > 90;
        if (isRed || isGreen || isDevilWhite) {
          isEmbCore[idx] = 1;
        }
      }
    }
  }

  // Dilate embroidery mask by 4px to preserve black outlines around devil, horseshoe, and 0880
  const isEmbProtected = new Uint8Array(isEmbCore);
  const rad = 4;
  for (let y = rad; y < h - rad; y++) {
    for (let x = rad; x < w - rad; x++) {
      if (isEmbCore[y * w + x]) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            isEmbProtected[(y + dy) * w + (x + dx)] = 1;
          }
        }
      }
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      if (data[i + 3] < 15) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 1. Sandwich brim lip on left/right
      const isBrimLip =
        (angle === "left" || angle === "right") &&
        y > h * 0.7 &&
        ((angle === "left" && x > w * 0.52) ||
          (angle === "right" && x < w * 0.48)) &&
        r > 55 &&
        r - g > 18;

      if (isBrimLip) {
        const lipShade = Math.min(1.2, Math.max(0.45, r / 185));
        out[i] = Math.min(255, Math.round(sR * lipShade));
        out[i + 1] = Math.min(255, Math.round(sG * lipShade));
        out[i + 2] = Math.min(255, Math.round(sB * lipShade));
        continue;
      }

      // 2. Protected embroidery
      if (isEmbProtected[idx]) continue;

      // 3. Back keyhole arch & snapback strap
      if (angle === "back") {
        const normX = (x - 0.5 * w) / (0.215 * w);
        const archTopY = h * (0.54 + 0.16 * normX * normX);
        const inKeyholeArch = Math.abs(normX) <= 1.0 && y >= archTopY;
        const inPlasticStrap =
          Math.abs(x - 0.5 * w) <= 0.225 * w && y >= h * 0.69;
        if (inKeyholeArch || inPlasticStrap) {
          continue;
        }
      }

      // 4. Studio fabric shading + cotton twill weave
      const sLum = (smoothData[i] + smoothData[i + 1] + smoothData[i + 2]) / 3;
      const origLum = (r + g + b) / 3;
      const seamDip = Math.min(0, origLum - sLum);
      const effectiveLum = Math.max(4, sLum + seamDip * 0.65);

      const twill = Math.sin((x + y) * 1.5) * 0.025;
      const shade = Math.max(
        0.32,
        Math.min(1.22, 0.58 + (effectiveLum - 18) * 0.016 + twill)
      );
      const spec = Math.max(0, (effectiveLum - 38) * 0.8);

      let tR = pR;
      let tG = pG;
      let tB = pB;

      if (spec.isTruckerMesh) {
        let frontPanelWeight = 0;
        if (angle === "left") {
          const seamX = w * 0.39 + (y - h * 0.14) * 0.42;
          const visorY = h * 0.665 - Math.max(0, x - w * 0.56) * 0.28;
          if (y < visorY && x > seamX) {
            frontPanelWeight =
              Math.min(1, (x - seamX) / 8) * Math.min(1, (visorY - y) / 8);
          }
        } else if (angle === "right") {
          const seamX = w * 0.61 - (y - h * 0.14) * 0.42;
          const visorY = h * 0.665 - Math.max(0, w * 0.44 - x) * 0.28;
          if (y < visorY && x < seamX) {
            frontPanelWeight =
              Math.min(1, (seamX - x) / 8) * Math.min(1, (visorY - y) / 8);
          }
        }
        const isMeshRegion =
          y < h * 0.66 &&
          (angle === "back" ||
            (angle === "left" && x <= w * 0.62) ||
            (angle === "right" && x >= w * 0.38));
        const meshPattern =
          isMeshRegion && (x + y) % 5 === 0 && (x - y + 1024) % 5 === 0
            ? 0.55
            : 1.0;
        const mR = 26 * meshPattern;
        const mG = 26 * meshPattern;
        const mB = 30 * meshPattern;
        tR = Math.round(pR * frontPanelWeight + mR * (1 - frontPanelWeight));
        tG = Math.round(pG * frontPanelWeight + mG * (1 - frontPanelWeight));
        tB = Math.round(pB * frontPanelWeight + mB * (1 - frontPanelWeight));
      } else if (spec.camoType === "woodland") {
        const n = camoNoise(x, y);
        if (n < 0.36) {
          tR = 28;
          tG = 32;
          tB = 24;
        } else if (n < 0.56) {
          tR = 63;
          tG = 78;
          tB = 47;
        } else if (n < 0.74) {
          tR = 92;
          tG = 72;
          tB = 48;
        } else {
          tR = 132;
          tG = 118;
          tB = 84;
        }
      } else if (spec.camoType === "urban") {
        const n = camoNoise(x, y);
        if (n < 0.38) {
          tR = 24;
          tG = 26;
          tB = 30;
        } else if (n < 0.62) {
          tR = 55;
          tG = 60;
          tB = 68;
        } else if (n < 0.8) {
          tR = 88;
          tG = 94;
          tB = 104;
        } else {
          tR = 38;
          tG = 42;
          tB = 48;
        }
      }

      out[i] = Math.max(0, Math.min(255, Math.round(tR * shade + spec)));
      out[i + 1] = Math.max(0, Math.min(255, Math.round(tG * shade + spec)));
      out[i + 2] = Math.max(0, Math.min(255, Math.round(tB * shade + spec)));
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ quality: 95 })
    .toBuffer();
}

/**
 * Generate a clean SVG vector contour path from a 1024x1024 RGBA buffer
 * by tracing the left and right outer boundary across scanlines and simplifying into a smooth SVG polygon path.
 */
async function generateSvgSilhouette(
  normalizedPngBuf: Buffer,
  viewName: CardinalAngle
): Promise<{ svgContent: string; pathData: string }> {
  const { data, info } = await sharp(normalizedPngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const leftPoints: [number, number][] = [];
  const rightPoints: [number, number][] = [];

  const stepY = 8;
  for (let y = 0; y < h; y += stepY) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= 90) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1 && maxX !== -1) {
      leftPoints.push([minX, y]);
      rightPoints.push([maxX, y]);
    }
  }

  // Also trace bottom contour across X so the curved visor arch is captured accurately
  const bottomPoints: [number, number][] = [];
  if (rightPoints.length > 0 && leftPoints.length > 0) {
    const minBottomX = leftPoints[leftPoints.length - 1][0];
    const maxBottomX = rightPoints[rightPoints.length - 1][0];
    for (let x = maxBottomX; x >= minBottomX; x -= 16) {
      let maxY = -1;
      for (let y = h - 1; y >= 0; y--) {
        if (data[(y * w + x) * 4 + 3] >= 90) {
          maxY = y;
          break;
        }
      }
      if (maxY !== -1) {
        bottomPoints.push([x, maxY]);
      }
    }
  }

  const allPts: [number, number][] = [
    ...rightPoints,
    ...bottomPoints,
    ...leftPoints.reverse(),
  ];

  const pathData =
    allPts
      .map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x},${y}`)
      .join(" ") + " Z";

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <title>MoyaCaps ${viewName} 3D Silhouette Mask</title>
  <path d="${pathData}" fill="currentColor" />
</svg>`;

  return { svgContent, pathData };
}

async function main() {
  console.log("🚀 Starting Automated Cap Asset Pipeline (scripts/process-cap-assets.ts)...");

  const rootDir = process.cwd();
  const publicCapsDir = path.join(rootDir, "public", "caps");
  const anglesDir = path.join(publicCapsDir, "angles");
  const processedRootDir = path.join(rootDir, "public", "images", "caps", "processed");
  const silhouettesDir = path.join(processedRootDir, "silhouettes");

  await fs.mkdir(processedRootDir, { recursive: true });
  await fs.mkdir(silhouettesDir, { recursive: true });

  // 1. Auto-discover source composite grids & HQ renders
  const caps1Path = path.join(rootDir, "images", "caps1.png");
  const caps2Path = path.join(rootDir, "images", "caps2.png");
  console.log(`📂 Discovered main cap directory: ${publicCapsDir}`);
  console.log(`📂 Discovered angles directory: ${anglesDir}`);
  console.log(`📂 Discovered multi-angle grid sources: ${caps1Path}, ${caps2Path}`);

  // 2. Process Master 4 Cardinal Views (front, left, back, right)
  console.log("✨ Cleaning & normalizing master cardinal angles (1024x1024)...");
  const hq2Buf = await fs.readFile(path.join(rootDir, "public/caps/hq2.png"));
  const hq1Buf = await fs.readFile(path.join(rootDir, "public/caps/hq1.png"));

  const caps2Meta = await sharp(caps2Path).metadata();
  const imgW = caps2Meta.width || 1254;
  const imgH = caps2Meta.height || 1254;
  const topH = 840;
  const bottomH = imgH - topH;
  const colW3 = Math.floor(imgW / 3);

  const leftRawCrop = await sharp(caps2Path)
    .extract({ left: 4, top: topH + 6, width: colW3 - 8, height: bottomH - 86 })
    .png()
    .toBuffer();
  const backRawCrop = await sharp(caps2Path)
    .extract({
      left: colW3 + 4,
      top: topH + 6,
      width: colW3 - 8,
      height: bottomH - 86,
    })
    .png()
    .toBuffer();
  const rightRawCrop = await sharp(caps2Path)
    .extract({
      left: colW3 * 2 + 4,
      top: topH + 6,
      width: imgW - colW3 * 2 - 8,
      height: bottomH - 86,
    })
    .png()
    .toBuffer();

  const masterFront = await cleanMasterView(hq2Buf, "front");
  const masterVerdeFront = await cleanMasterView(hq1Buf, "front");
  const masterLeft = await cleanMasterView(leftRawCrop, "left");
  const masterBack = await cleanMasterView(backRawCrop, "back");
  const masterRight = await cleanMasterView(rightRawCrop, "right");

  // Save normalized master angles back to /public/caps/angles/
  await fs.writeFile(path.join(anglesDir, "front.png"), masterFront);
  await fs.writeFile(path.join(anglesDir, "left.png"), masterLeft);
  await fs.writeFile(path.join(anglesDir, "back.png"), masterBack);
  await fs.writeFile(path.join(anglesDir, "right.png"), masterRight);
  console.log("✅ Saved normalized 1024x1024 master views to /public/caps/angles/");

  // 3. Generate SVG silhouettes for all 4 cardinal angles
  console.log("📐 Generating SVG vector contour silhouettes...");
  const masterMap: Record<CardinalAngle, Buffer> = {
    front: masterFront,
    right: masterRight,
    back: masterBack,
    left: masterLeft,
  };
  const svgPaths: Record<CardinalAngle, string> = {
    front: "",
    right: "",
    back: "",
    left: "",
  };

  for (const angle of ["front", "right", "back", "left"] as CardinalAngle[]) {
    const { svgContent, pathData } = await generateSvgSilhouette(
      masterMap[angle],
      angle
    );
    svgPaths[angle] = pathData;
    await fs.writeFile(path.join(silhouettesDir, `${angle}.svg`), svgContent);
  }

  // 4. Build full-brim centroid-aligned extractor for caps1.png cells
  console.log("🎨 Extracting & normalizing all cap colorways and multi-angle views...");
  const fullCaps1 = await sharp(caps1Path)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W1 = fullCaps1.info.width;
  const cellW = 313;
  const cellH = 272;

  const brimBottomY = new Int16Array(cellW).fill(203);
  for (let x = 24; x <= 289; x++) {
    let maxRedY = -1;
    for (let y = 215; y < cellH; y++) {
      const i = (y * W1 + x) * 3;
      const r = fullCaps1.data[i];
      const g = fullCaps1.data[i + 1];
      const b = fullCaps1.data[i + 2];
      if (r > 70 && r - g >= 22 && r - b >= 22) {
        maxRedY = y;
      }
    }
    if (maxRedY !== -1) {
      brimBottomY[x] = maxRedY - 1;
    }
  }
  for (let x = 26; x <= 287; x++) {
    if (brimBottomY[x] === 203) {
      const norm = (x - 156.5) / 125;
      brimBottomY[x] = Math.round(240 + 26 * norm * norm);
    }
  }

  const isBg1 = new Uint8Array(cellW * cellH);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const i = (y * W1 + x) * 3;
      const r = fullCaps1.data[i];
      const g = fullCaps1.data[i + 1];
      const b = fullCaps1.data[i + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      if (x <= 4 || x >= cellW - 5 || y <= 4) isBg1[y * cellW + x] = 1;
      else if (x >= 28 && x <= 285 && y > brimBottomY[x]) isBg1[y * cellW + x] = 1;
      else if ((x < 28 || x > 285) && y > 199) isBg1[y * cellW + x] = 1;
      else if (sat <= 14 && lum >= 85) isBg1[y * cellW + x] = 1;
    }
  }

  const ext1 = new Uint8Array(cellW * cellH);
  const q1: number[] = [];
  for (let x = 0; x < cellW; x++) {
    if (isBg1[x]) {
      ext1[x] = 1;
      q1.push(x);
    }
    const b = (cellH - 1) * cellW + x;
    if (isBg1[b]) {
      ext1[b] = 1;
      q1.push(b);
    }
  }
  for (let y = 0; y < cellH; y++) {
    const l = y * cellW;
    const r = y * cellW + (cellW - 1);
    if (isBg1[l] && !ext1[l]) {
      ext1[l] = 1;
      q1.push(l);
    }
    if (isBg1[r] && !ext1[r]) {
      ext1[r] = 1;
      q1.push(r);
    }
  }
  let head1 = 0;
  while (head1 < q1.length) {
    const curr = q1[head1++];
    const cx = curr % cellW;
    const cy = (curr - cx) / cellW;
    for (const n of [
      cx > 0 ? curr - 1 : -1,
      cx < cellW - 1 ? curr + 1 : -1,
      cy > 0 ? curr - cellW : -1,
      cy < cellH - 1 ? curr + cellW : -1,
    ]) {
      if (n >= 0 && !ext1[n] && isBg1[n]) {
        ext1[n] = 1;
        q1.push(n);
      }
    }
  }

  // Erode 1px on upper crown perimeter to prevent any gray studio border halo
  const mask1 = new Uint8Array(ext1);
  for (let y = 1; y < 210; y++) {
    for (let x = 1; x < cellW - 1; x++) {
      const idx = y * cellW + x;
      if (
        !ext1[idx] &&
        (ext1[idx - 1] ||
          ext1[idx + 1] ||
          ext1[idx - cellW] ||
          ext1[idx + cellW])
      ) {
        mask1[idx] = 1;
      }
    }
  }

  function getCloverCentroid(r: number, c: number) {
    const x0 = Math.round(c * 313.5);
    const y0 = Math.round(r * 313.5);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 60; y < 180; y++) {
      for (let x = 90; x < 220; x++) {
        const i = ((y0 + y) * W1 + (x0 + x)) * 3;
        const R = fullCaps1.data[i];
        const G = fullCaps1.data[i + 1];
        const B = fullCaps1.data[i + 2];
        if (G > 130 && G - R > 45 && G - B > 45) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    return { cx: sx / n, cy: sy / n };
  }

  const baseCentroid = getCloverCentroid(0, 0);

  for (const spec of COLORWAY_SPECS) {
    const outDir = path.join(processedRootDir, spec.id);
    await fs.mkdir(outDir, { recursive: true });

    let frontNormalized: Buffer;
    if (spec.id === "negro-rojo") {
      frontNormalized = masterFront;
    } else if (spec.id === "verde-rojo") {
      frontNormalized = masterVerdeFront;
    } else {
      const curCentroid = getCloverCentroid(spec.gridRow, spec.gridCol);
      const dx = Math.round(curCentroid.cx - baseCentroid.cx);
      const dy = Math.round(curCentroid.cy - baseCentroid.cy);
      const x0 = Math.round(spec.gridCol * 313.5);
      const y0 = Math.round(spec.gridRow * 313.5);

      const cellOut = Buffer.alloc(cellW * cellH * 4);
      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const sy = y + dy;
          const sx = x + dx;
          const maskIdx = y * cellW + x;
          if (
            mask1[maskIdx] ||
            sx < 0 ||
            sx >= cellW ||
            sy < 0 ||
            sy >= cellH
          ) {
            cellOut[maskIdx * 4 + 3] = 0;
          } else {
            const srcIdx = ((y0 + sy) * W1 + (x0 + sx)) * 3;
            cellOut[maskIdx * 4] = fullCaps1.data[srcIdx];
            cellOut[maskIdx * 4 + 1] = fullCaps1.data[srcIdx + 1];
            cellOut[maskIdx * 4 + 2] = fullCaps1.data[srcIdx + 2];
            let adj = 0;
            if (x > 0 && mask1[maskIdx - 1]) adj++;
            if (x < cellW - 1 && mask1[maskIdx + 1]) adj++;
            if (y > 0 && mask1[maskIdx - cellW]) adj++;
            if (y < cellH - 1 && mask1[maskIdx + cellW]) adj++;
            cellOut[maskIdx * 4 + 3] = adj >= 2 ? 110 : adj === 1 ? 205 : 255;
          }
        }
      }

      const rawCutout = await sharp(cellOut, {
        raw: { width: cellW, height: cellH, channels: 4 },
      })
        .sharpen({ sigma: 1.15 })
        .png()
        .toBuffer();

      frontNormalized = await normalizeTo1024Canvas(rawCutout, "front");
    }

    const rightNormalized = await synthesizeAngleViewForColorway(
      masterRight,
      "right",
      spec
    );
    const backNormalized = await synthesizeAngleViewForColorway(
      masterBack,
      "back",
      spec
    );
    const leftNormalized = await synthesizeAngleViewForColorway(
      masterLeft,
      "left",
      spec
    );

    await fs.writeFile(path.join(outDir, "front.png"), frontNormalized);
    await fs.writeFile(path.join(outDir, "right.png"), rightNormalized);
    await fs.writeFile(path.join(outDir, "back.png"), backNormalized);
    await fs.writeFile(path.join(outDir, "left.png"), leftNormalized);

    // Also update the main /public/caps/[id].png so existing catalog cards have the clean full-brim cutout!
    await fs.writeFile(path.join(publicCapsDir, `${spec.id}.png`), frontNormalized);

    console.log(
      `   ✔ Processed ${spec.id} -> [front, right, back, left] (1024x1024)`
    );
  }

  // 5. Generate Strictly Typed Manifest (src/data/capsManifest.ts)
  console.log("📝 Generating strictly typed manifest (src/data/capsManifest.ts)...");
  const core12 = COLORWAY_SPECS.filter((s) => s.isCore12);

  const manifestTs = `/**
 * AUTO-GENERATED BY scripts/process-cap-assets.ts
 * Multi-Angle Cap Asset Manifest (real-photo turntable)
 */

export type CapAngleKey = "front" | "right" | "back" | "left";

export type CoreCapColorwayId =
${core12.map((c) => `  | "${c.id}"`).join("\n")};

export type AnyCapColorwayId =
${COLORWAY_SPECS.map((c) => `  | "${c.id}"`).join("\n")};

export interface CapAngleAssets {
  /** 0° Front view ("Good Luck!!!" horseshoe & 4-leaf clover 3D puff embroidery) */
  front: string;
  /** 90° Right side profile (devil with pitchfork side patch) */
  right: string;
  /** 180° Rear view ("0880" red embroidery & adjustable snapback strap) */
  back: string;
  /** 270° Left side profile (devil with pitchfork side patch) */
  left: string;
}

export interface CapColorwayManifestItem {
  id: CoreCapColorwayId;
  nameEn: string;
  nameEs: string;
  primaryHex: string;
  secondaryHex: string;
  isTruckerMesh: boolean;
  camoPattern: "woodland" | "urban" | null;
  angles: CapAngleAssets;
  svgSilhouettes: Record<CapAngleKey, string>;
}

export const CAP_SVG_SILHOUETTE_PATHS: Record<CapAngleKey, string> = {
  front: ${JSON.stringify(svgPaths.front)},
  right: ${JSON.stringify(svgPaths.right)},
  back: ${JSON.stringify(svgPaths.back)},
  left: ${JSON.stringify(svgPaths.left)},
};

export const CAP_SVG_SILHOUETTE_URLS: Record<CapAngleKey, string> = {
  front: "/images/caps/processed/silhouettes/front.svg",
  right: "/images/caps/processed/silhouettes/right.svg",
  back: "/images/caps/processed/silhouettes/back.svg",
  left: "/images/caps/processed/silhouettes/left.svg",
};


/**
 * The 12 primary cap colorways with normalized 1024x1024 cardinal angle assets
 */
export const CAPS_MANIFEST: readonly CapColorwayManifestItem[] = [
${core12
  .map(
    (c) => `  {
    id: "${c.id}",
    nameEn: ${JSON.stringify(c.nameEn)},
    nameEs: ${JSON.stringify(c.nameEs)},
    primaryHex: "${c.primaryHex}",
    secondaryHex: "${c.secondaryHex}",
    isTruckerMesh: ${c.isTruckerMesh},
    camoPattern: ${c.camoType ? `"${c.camoType}"` : "null"},
    angles: {
      front: "/images/caps/processed/${c.id}/front.png",
      right: "/images/caps/processed/${c.id}/right.png",
      back: "/images/caps/processed/${c.id}/back.png",
      left: "/images/caps/processed/${c.id}/left.png",
    },
    svgSilhouettes: CAP_SVG_SILHOUETTE_URLS,
  }`
  )
  .join(",\n")}
] as const;

export const ALL_CAPS_MANIFEST_MAP: Record<AnyCapColorwayId, Omit<CapColorwayManifestItem, "id"> & { id: AnyCapColorwayId }> = {
${COLORWAY_SPECS.map(
  (c) => `  "${c.id}": {
    id: "${c.id}",
    nameEn: ${JSON.stringify(c.nameEn)},
    nameEs: ${JSON.stringify(c.nameEs)},
    primaryHex: "${c.primaryHex}",
    secondaryHex: "${c.secondaryHex}",
    isTruckerMesh: ${c.isTruckerMesh},
    camoPattern: ${c.camoType ? `"${c.camoType}"` : "null"},
    angles: {
      front: "/images/caps/processed/${c.id}/front.png",
      right: "/images/caps/processed/${c.id}/right.png",
      back: "/images/caps/processed/${c.id}/back.png",
      left: "/images/caps/processed/${c.id}/left.png",
    },
    svgSilhouettes: CAP_SVG_SILHOUETTE_URLS,
  }`
).join(",\n")}
};

export function getCapColorwayManifest(id: string): (Omit<CapColorwayManifestItem, "id"> & { id: string }) {
  return (
    (ALL_CAPS_MANIFEST_MAP as Record<string, Omit<CapColorwayManifestItem, "id"> & { id: string }>)[id] ??
    CAPS_MANIFEST[0]
  );
}
`;

  const manifestFilePath = path.join(rootDir, "src", "data", "capsManifest.ts");
  await fs.writeFile(manifestFilePath, manifestTs, "utf8");
  console.log(`✅ Generated typed manifest at ${manifestFilePath}`);
  console.log("🎉 Asset processing pipeline completed successfully!");
}

main().catch((err) => {
  console.error("❌ Error in process-cap-assets:", err);
  process.exit(1);
});
