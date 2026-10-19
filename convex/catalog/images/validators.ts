import { ConvexError, v } from "convex/values";

export const imageRoleValidator = v.union(v.literal("catalog"), v.literal("lifestyle"), v.literal("angle"));
export const capAngleValidator = v.union(v.literal("front"), v.literal("left"), v.literal("back"), v.literal("right"));

/** Structured rejection the admin UI maps to a message by `code`. */
export const imageRuleError = (code: string) => new ConvexError({ kind: "image_rule", code });
