import { z } from "zod";

export const shippingAddressSchema = z.object({
  line1: z
    .string()
    .min(1, { message: "validation.required" })
    .max(120, { message: "validation.tooLong" }),
  line2: z
    .string()
    .max(120, { message: "validation.tooLong" })
    .optional(),
  city: z
    .string()
    .min(1, { message: "validation.required" })
    .max(80, { message: "validation.tooLong" }),
  state: z
    .string()
    .min(1, { message: "validation.required" })
    .max(80, { message: "validation.tooLong" }),
  postalCode: z
    .string()
    .min(1, { message: "validation.required" })
    .min(2, { message: "validation.invalidPostalCode" })
    .max(20, { message: "validation.tooLong" }),
  country: z
    .string()
    .optional(),
  customerName: z
    .string()
    .max(100, { message: "validation.tooLong" })
    .optional(),
  customerPhone: z
    .string()
    .max(30, { message: "validation.tooLong" })
    .optional(),
  customerEmail: z
    .string()
    .email({ message: "validation.invalidEmail" })
    .optional()
    .or(z.literal("")),
});

export type ShippingAddressValues = z.infer<typeof shippingAddressSchema>;
