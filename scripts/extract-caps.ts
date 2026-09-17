import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

async function main() {
  const publicCapsDir = path.join(process.cwd(), "public", "caps");
  const anglesDir = path.join(publicCapsDir, "angles");

  await fs.mkdir(publicCapsDir, { recursive: true });
  await fs.mkdir(anglesDir, { recursive: true });

  const caps1Path = path.join(process.cwd(), "images", "caps1.png");
  const caps2Path = path.join(process.cwd(), "images", "caps2.png");

  // Grid mapping for caps1.png (4 rows, 4 cols)
  // Total size: 1254 x 1254
  const cellW = 1254 / 4; // 313.5
  const cellH = 1254 / 4; // 313.5

  const capVariants = [
    // Row 0
    { id: "negro-rojo", row: 0, col: 0, nameEn: "Black / Red", nameEs: "Negro / Rojo", type: "snapback", hex: "#111111", secondaryHex: "#ef4444" },
    { id: "blanco-rojo", row: 0, col: 1, nameEn: "White / Red", nameEs: "Blanco / Rojo", type: "snapback", hex: "#f8fafc", secondaryHex: "#ef4444" },
    { id: "azul-marino-rojo", row: 0, col: 2, nameEn: "Navy / Red", nameEs: "Azul Marino / Rojo", type: "snapback", hex: "#1e293b", secondaryHex: "#ef4444" },
    { id: "rojo-negro", row: 0, col: 3, nameEn: "Red / Black", nameEs: "Rojo / Negro", type: "snapback", hex: "#ef4444", secondaryHex: "#111111" },

    // Row 1
    { id: "verde-rojo", row: 1, col: 0, nameEn: "Forest Green / Red", nameEs: "Verde / Rojo", type: "snapback", hex: "#14532d", secondaryHex: "#ef4444" },
    { id: "gris-rojo", row: 1, col: 1, nameEn: "Heather Grey / Red", nameEs: "Gris / Rojo", type: "snapback", hex: "#6b7280", secondaryHex: "#ef4444" },
    { id: "beige-rojo", row: 1, col: 2, nameEn: "Beige Tan / Red", nameEs: "Beige / Rojo", type: "snapback", hex: "#d6c7a1", secondaryHex: "#ef4444" },
    { id: "marron-rojo", row: 1, col: 3, nameEn: "Chocolate Brown / Red", nameEs: "Marrón / Rojo", type: "snapback", hex: "#451a03", secondaryHex: "#ef4444" },

    // Row 2
    { id: "azul-rey-blanco", row: 2, col: 0, nameEn: "Royal Blue / White", nameEs: "Azul Rey / Blanco", type: "snapback", hex: "#1d4ed8", secondaryHex: "#ffffff" },
    { id: "rosa-blanco", row: 2, col: 1, nameEn: "Soft Pink / White", nameEs: "Rosa / Blanco", type: "snapback", hex: "#f472b6", secondaryHex: "#ffffff" },
    { id: "morado-blanco", row: 2, col: 2, nameEn: "Deep Purple / White", nameEs: "Morado / Blanco", type: "snapback", hex: "#6b21a8", secondaryHex: "#ffffff" },
    { id: "turquesa-blanco", row: 2, col: 3, nameEn: "Cyan Turquoise / White", nameEs: "Turquesa / Blanco", type: "snapback", hex: "#06b6d4", secondaryHex: "#ffffff" },

    // Row 3
    { id: "camuflaje-negro", row: 3, col: 0, nameEn: "Woodland Camo / Black", nameEs: "Camuflaje / Negro", type: "snapback", hex: "#3f4733", secondaryHex: "#111111" },
    { id: "gris-negro-trucker", row: 3, col: 1, nameEn: "Grey / Black Trucker Mesh", nameEs: "Gris / Negro (Trucker)", type: "trucker", hex: "#4b5563", secondaryHex: "#111111" },
    { id: "blanco-negro-trucker", row: 3, col: 2, nameEn: "White / Black Trucker Mesh", nameEs: "Blanco / Negro (Trucker)", type: "trucker", hex: "#f8fafc", secondaryHex: "#111111" },
    { id: "camuflaje-gris-negro", row: 3, col: 3, nameEn: "Urban Grey Camo / Black", nameEs: "Camuflaje Gris / Negro", type: "snapback", hex: "#374151", secondaryHex: "#111111" },
  ];

  console.log("Extracting 16 cap variants from caps1.png...");
  for (const cap of capVariants) {
    const left = Math.round(cap.col * cellW);
    const top = Math.round(cap.row * cellH);
    const width = Math.min(Math.round(cellW), 1254 - left);
    const height = Math.min(Math.round(cellH), 1254 - top);

    // Extract the full cell
    const outPath = path.join(publicCapsDir, `${cap.id}.png`);
    await sharp(caps1Path)
      .extract({ left, top, width, height })
      .png({ quality: 90 })
      .toFile(outPath);

    console.log(`Saved ${cap.id}.png`);
  }

  console.log("Extracting multi-angle views from caps2.png...");
  // caps2.png:
  // Top front view: roughly y: 0 to 850, full width 1254
  // Bottom row: roughly y: 850 to 1254 (height 404), 3 cols of ~418px each
  const caps2Meta = await sharp(caps2Path).metadata();
  const imgW = caps2Meta.width || 1254;
  const imgH = caps2Meta.height || 1254;

  const topH = 850;
  const bottomH = imgH - topH; // 404
  const colW3 = Math.floor(imgW / 3); // 418

  // 1. Front view (top main)
  await sharp(caps2Path)
    .extract({ left: 0, top: 0, width: imgW, height: topH })
    .png({ quality: 95 })
    .toFile(path.join(anglesDir, "front.png"));
  console.log("Saved angles/front.png");

  // 2. Left side (Lado Izquierdo)
  await sharp(caps2Path)
    .extract({ left: 0, top: topH, width: colW3, height: bottomH })
    .png({ quality: 95 })
    .toFile(path.join(anglesDir, "left.png"));
  console.log("Saved angles/left.png");

  // 3. Back view (Parte Trasera)
  await sharp(caps2Path)
    .extract({ left: colW3, top: topH, width: colW3, height: bottomH })
    .png({ quality: 95 })
    .toFile(path.join(anglesDir, "back.png"));
  console.log("Saved angles/back.png");

  // 4. Right side (Lado Derecho)
  const rightW = imgW - colW3 * 2;
  await sharp(caps2Path)
    .extract({ left: colW3 * 2, top: topH, width: rightW, height: bottomH })
    .png({ quality: 95 })
    .toFile(path.join(anglesDir, "right.png"));
  console.log("Saved angles/right.png");

  console.log("Extraction complete!");
}

main().catch(console.error);
