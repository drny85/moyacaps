"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { shippingAddressSchema, type ShippingAddressValues } from "@/lib/validations/address";
import { addressFormDefaults } from "@/lib/accountOrders";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { CustomerOrder } from "./types";

/** Modal for changing where a not-yet-shipped Order goes. Mount it only while open. */
export function EditAddressDialog({
  order,
  clerkUserId,
  onClose,
  onSaved,
}: {
  order: CustomerOrder;
  clerkUserId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("account");
  const updateAddressMutation = useMutation(api.orders.functions.updateShippingAddress);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const addressForm = useForm<ShippingAddressValues>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: addressFormDefaults(order),
    mode: "onSubmit",
  });

  const handleSaveAddress = async (data: ShippingAddressValues) => {
    try {
      setIsSavingAddress(true);
      await updateAddressMutation({
        orderId: order._id,
        clerkUserId,
        shippingAddress: {
          line1: data.line1,
          line2: data.line2 || undefined,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: order.shippingAddress?.country || data.country || "US",
        },
        customerPhone: data.customerPhone || undefined,
      });

      onSaved(t("addressUpdated"));
      onClose();
    } catch (err) {
      alert((err instanceof Error && err.message) || "Failed to update address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Edit3 className="w-4 h-4 text-moya-red" />
          <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
            {t("editAddress")}
          </h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Updating delivery address for Order #{order.orderNumber}
        </p>

        <Form {...addressForm}>
          <form onSubmit={addressForm.handleSubmit(handleSaveAddress)} className="space-y-3">
            <FormField
              control={addressForm.control}
              name="line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-zinc-500">Street Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Street & house number"
                      className="px-3.5 py-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={addressForm.control}
              name="line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-mono text-zinc-500">Apartment, Suite, Unit (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="APT 4B"
                      className="px-3.5 py-2 uppercase"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={addressForm.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-mono text-zinc-500">City</FormLabel>
                    <FormControl>
                      <Input
                        className="px-3.5 py-2 capitalize"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addressForm.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-mono text-zinc-500">State / Province</FormLabel>
                    <FormControl>
                      <Input
                        className="px-3.5 py-2 uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={addressForm.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-mono text-zinc-500">Postal / ZIP Code</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        className="px-3.5 py-2 font-mono"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addressForm.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-mono text-zinc-500">Phone (for Courier)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        className="px-3.5 py-2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingAddress}
                className="px-5 py-2 rounded-xl bg-moya-red hover:bg-rose-500 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-lg shadow-moya-red/30 disabled:opacity-50"
              >
                {isSavingAddress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isSavingAddress ? t("saving") : t("saveAddress")}</span>
              </button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
