import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

interface DesignConfig {
  id: string; // e.g. boxing-gloves
  graphicFile: string;
  printPosition: 'front' | 'back';
}

const DESIGNS: DesignConfig[] = [
  { id: 'boxing-gloves', graphicFile: 'boxing-gloves.jpg', printPosition: 'front' },
  { id: 'butterfly', graphicFile: 'butterfly.jpg', printPosition: 'front' },
  { id: 'eagle-clover', graphicFile: 'eagle-clover.jpg', printPosition: 'back' },
  { id: 'eight-ball', graphicFile: 'eight-ball.jpg', printPosition: 'front' },
  { id: 'lightning-star', graphicFile: 'lightning-star.jpg', printPosition: 'front' },
  { id: 'gothic-skull', graphicFile: 'gothic-skull.jpg', printPosition: 'front' },
  { id: 'retro-soul', graphicFile: 'retro-soul.jpg', printPosition: 'front' },
  { id: 'muscle-car', graphicFile: 'muscle-car.jpg', printPosition: 'front' },
  { id: 'vintage-f1', graphicFile: 'vintage-f1.jpg', printPosition: 'front' },
  { id: 'snake-horseshoe', graphicFile: 'snake-horseshoe.jpg', printPosition: 'back' },
  { id: 'angel-clover', graphicFile: 'angel-clover.jpg', printPosition: 'front' },
];

const COLORS = [
  { id: 'white', templateName: 'white', ext: 'jpg' },
  { id: 'grey', templateName: 'grey', ext: 'jpg' },
  { id: 'cream', templateName: 'cream', ext: 'jpg' },
  { id: 'black', templateName: 'black', ext: 'jpg' },
];

async function generateAll() {
  const publicShirtsDir = path.resolve('public/shirts');
  const graphicsDir = path.resolve('public/shirts/graphics');
  const templatesDir = path.resolve('public/shirts/templates');

  let generatedCount = 0;
  let skippedCount = 0;

  for (const design of DESIGNS) {
    const graphicPath = path.join(graphicsDir, design.graphicFile);
    if (!fs.existsSync(graphicPath)) {
      console.warn(`Graphic not found: ${graphicPath}`);
      continue;
    }

    for (const color of COLORS) {
      // Determine destination filename
      let destFilename = `${design.id}-${color.id}.jpg`;
      
      // Existing files (including official photoshoot shots) are never overwritten: see the [EXISTS] check below.

      const destPath = path.join(publicShirtsDir, destFilename);

      if (fs.existsSync(destPath)) {
        console.log(`[EXISTS] ${destFilename}`);
        skippedCount++;
        continue;
      }

      // Template selection
      const templateFilename = `${design.printPosition}-${color.templateName}.jpg`;
      const templatePath = path.join(templatesDir, templateFilename);

      if (!fs.existsSync(templatePath)) {
        console.error(`Template not found: ${templatePath}`);
        continue;
      }

      console.log(`[GENERATING] ${destFilename} using ${templateFilename}...`);

      if (design.printPosition === 'front') {
        const resized = await sharp(graphicPath)
          .resize({ width: 285, height: 355, fit: 'inside' })
          .toBuffer();
        
        const meta = await sharp(resized).metadata();
        const left = Math.round(485 - (meta.width || 285) / 2);
        const top = 280;

        await sharp(templatePath)
          .composite([
            {
              input: resized,
              top,
              left,
              blend: 'multiply',
            },
          ])
          .jpeg({ quality: 92 })
          .toFile(destPath);
      } else {
        // Back print
        const resized = await sharp(graphicPath)
          .resize({ width: 280, height: 380, fit: 'inside' })
          .toBuffer();
        
        const meta = await sharp(resized).metadata();
        const left = Math.round(455 - (meta.width || 280) / 2);
        const top = 265;

        await sharp(templatePath)
          .composite([
            {
              input: resized,
              top,
              left,
              blend: 'multiply',
            },
          ])
          .jpeg({ quality: 92 })
          .toFile(destPath);
      }

      generatedCount++;
      console.log(`[SUCCESS] Generated ${destFilename}`);
    }
  }

  console.log(`\nDone! Generated: ${generatedCount}, Preserved existing: ${skippedCount}`);
}

generateAll().catch(console.error);
