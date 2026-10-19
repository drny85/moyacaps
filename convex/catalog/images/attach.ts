import { v, ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { actorEmail } from "../audit";
import { requireAdminInAction } from "../../lib/auth";
import { readImageHeader } from "./header";
import { checkImageUpload } from "./rules";
import { capAngleValidator, imageRoleValidator } from "./functions";

const HEADER_BYTES = 64 * 1024;

const imageRuleError = (code: string) => new ConvexError({ kind: "image_rule", code });

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Admin: validate a freshly uploaded file (client uploads via `generateUploadUrl`) and attach
 * it to a product slot. Any failure after the upload deletes the file.
 */
export const attachImage = action({
  args: {
    variantId: v.string(),
    storageId: v.id("_storage"),
    role: imageRoleValidator,
    colorway: v.optional(v.string()),
    angle: v.optional(capAngleValidator),
    replaceImageId: v.optional(v.id("productImages")),
  },
  returns: v.object({ imageId: v.id("productImages") }),
  handler: async (ctx, args): Promise<{ imageId: Id<"productImages"> }> => {
    const actor = actorEmail(await requireAdminInAction(ctx));
    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw imageRuleError("unsupported_format");
      const header = readImageHeader(new Uint8Array(await blob.slice(0, HEADER_BYTES).arrayBuffer()));
      const failure = checkImageUpload({ role: args.role, bytes: blob.size, header });
      if (failure || !header) throw imageRuleError(failure ?? "unsupported_format");
      const sha256 = await sha256Hex(await blob.arrayBuffer());
      return await ctx.runMutation(internal.catalog.images.functions.insertOrReplaceImage, {
        ...args,
        actor,
        sha256,
        width: header.width,
        height: header.height,
      });
    } catch (e) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // already gone
      }
      throw e;
    }
  },
});
