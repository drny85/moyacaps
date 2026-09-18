import { z } from "zod";

export const trackingLookupSchema = z.object({
  orderNumber: z
    .string()
    .min(1, { message: "validation.required" })
    .min(3, { message: "validation.orderNumberMin" }),
  email: z
    .string()
    .min(1, { message: "validation.required" })
    .email({ message: "validation.invalidEmail" }),
});

export type TrackingLookupValues = z.infer<typeof trackingLookupSchema>;
