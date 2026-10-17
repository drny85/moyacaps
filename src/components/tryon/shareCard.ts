/**
 * The Try-On share card (ADR 0019), loaded only when the Customer shares or saves. It draws
 * with the same placement as the stage (`placeCap`), so the card matches the screen.
 */
import { cardFileName, cardLayout } from "@/lib/tryOn/photo";
import type { CapPlacement } from "@/lib/tryOn/fit";

export interface CardInput {
  photoUrl: string;
  overlayUrl: string;
  placement: CapPlacement;
  capId: string;
  capName: string;
  price: string;
  brand: string;
  /** CSS font-family stacks resolved from the page (next/font names are hashed) */
  fonts: { display: string; body: string };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

export async function renderCard(input: CardInput): Promise<Blob> {
  const layout = cardLayout();
  const [photo, cap] = await Promise.all([loadImage(input.photoUrl), loadImage(input.overlayUrl)]);
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 0, layout.width, layout.height);
  const p = layout.photo;
  ctx.drawImage(photo, p.x, p.y, p.width, p.height);

  const { x, y, size, rotation } = input.placement;
  ctx.save();
  ctx.translate(p.x + x * p.width, p.y + y * p.height);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = p.width * 0.03;
  ctx.shadowOffsetY = p.width * 0.015;
  const side = size * p.width;
  ctx.drawImage(cap, -side / 2, -side / 2, side, side);
  ctx.restore();

  const c = layout.caption;
  const width = c.right - c.x;
  ctx.fillStyle = "#e11d48";
  ctx.font = `600 ${Math.round(layout.width * 0.026)}px ${input.fonts.body}`;
  ctx.fillText(input.brand, c.x, c.brandY);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(layout.width * 0.056)}px ${input.fonts.display}`;
  const priceWidth = ctx.measureText(input.price).width;
  ctx.fillText(fitText(ctx, input.capName.toUpperCase(), width - priceWidth - layout.width * 0.04), c.x, c.nameY);
  ctx.textAlign = "right";
  ctx.fillText(input.price, c.right, c.priceY);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the card"))), "image/jpeg", 0.9)
  );
}

/** Opens the share sheet where files can be shared, otherwise downloads the card */
export async function shareOrSave(blob: Blob, capId: string, title: string): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], cardFileName(capId), { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}
