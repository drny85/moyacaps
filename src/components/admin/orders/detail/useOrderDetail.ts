"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { allowedManualMoves, manualTrackingMove, nextOrderAction } from "@/lib/admin/orderActions";
import { toOrderDetail } from "@/lib/admin/orderDetail";

export type AddressForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) return typeof err.data === "string" ? err.data : fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}

/** The detail page's data and every action it can take; each action reports success or failure in the page's words. */
export function useOrderDetail(orderNumber: string) {
  const t = useTranslations("admin.orderDetail.toast");
  const tCommon = useTranslations("admin.common");
  const locale = useLocale() as "en" | "es";
  const now = useMinuteClock();

  const order = useQuery(api.orders.desk.getOrderDetailAdmin, { orderNumber });
  // Packing images and option names come from the catalog rows the Products grid already caches.
  const catalog = useQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: true });

  const updateFulfillmentStatus = useMutation(api.orders.desk.updateFulfillmentStatusAdmin);
  const updateOrderFulfillment = useMutation(api.orders.desk.updateOrderFulfillmentAdmin);
  const updateShippingAddress = useMutation(api.orders.desk.updateShippingAddressAdmin);
  const cancelAndRefund = useAction(api.payments.refunds.cancelAndRefundOrderAdmin);
  const clearHandoff = useMutation(api.orders.handoffs.clearHandoff);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(id);
  }, [success]);

  const vm = useMemo(() => (order ? toOrderDetail(order, catalog?.variants, locale, now) : null), [order, catalog, locale, now]);
  const nextAction = useMemo(() => (order ? nextOrderAction(order) : null), [order]);
  const manualMoves = useMemo(() => (order ? allowedManualMoves(order) : []), [order]);

  const run = useCallback(
    async (work: () => Promise<string>) => {
      setBusy(true);
      setError(null);
      try {
        setSuccess(await work());
        return true;
      } catch (err) {
        setError(errorMessage(err, tCommon("actionFailed")));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [tCommon]
  );

  const actions = useMemo(
    () => ({
      saveAddress: (form: AddressForm) =>
        run(async () => {
          if (!order) throw new Error();
          await updateShippingAddress({
            orderId: order._id,
            customerName: form.customerName.trim() || undefined,
            customerEmail: form.customerEmail.trim() || undefined,
            customerPhone: form.customerPhone.trim() || undefined,
            shippingAddress: {
              line1: form.line1.trim(),
              line2: form.line2.trim() || undefined,
              city: form.city.trim(),
              state: form.state.trim(),
              postalCode: form.postalCode.trim(),
              country: form.country.trim(),
            },
          });
          return t("address");
        }),
      saveNotes: (text: string) =>
        run(async () => {
          if (!order) throw new Error();
          await updateOrderFulfillment({ orderId: order._id, adminNotes: text.trim() });
          return t("notes");
        }),
      saveTracking: (input: { carrier: string; trackingNumber: string }) =>
        run(async () => {
          if (!order) throw new Error();
          const trackingNumber = input.trackingNumber.trim() || undefined;
          const move = manualTrackingMove(order);
          if (move) {
            // Shipped by hand: the Order leaves Needs Packing and the customer gets the dispatch email.
            await updateFulfillmentStatus({ orderId: order._id, fulfillmentStatus: move, carrier: input.carrier, trackingNumber });
            return t("dispatched");
          }
          await updateOrderFulfillment({ orderId: order._id, carrier: input.carrier, trackingNumber });
          return t("tracking");
        }),
      markDelivered: () =>
        run(async () => {
          if (!order) throw new Error();
          await updateFulfillmentStatus({ orderId: order._id, fulfillmentStatus: "delivered" });
          return t("delivered");
        }),
      revert: () =>
        run(async () => {
          if (!order) throw new Error();
          await updateFulfillmentStatus({ orderId: order._id, fulfillmentStatus: "in_transit" });
          return t("reverted");
        }),
      removeHandoff: () =>
        run(async () => {
          if (!order) throw new Error();
          await clearHandoff({ orderId: order._id });
          return t("handoffRemoved");
        }),
      cancel: (input: { refundStripe: boolean; reason: string }) =>
        run(async () => {
          if (!order) throw new Error();
          const reason = input.reason.trim() || undefined;
          const result = await cancelAndRefund({
            orderId: order._id,
            refundStripe: input.refundStripe,
            reason,
            ...(!input.refundStripe && { adminNotes: reason }),
          });
          if (result.refundError && input.refundStripe) throw new ConvexError(result.message);
          return t("cancelled");
        }),
    }),
    [order, run, t, updateShippingAddress, updateOrderFulfillment, updateFulfillmentStatus, cancelAndRefund, clearHandoff]
  );

  return {
    order,
    vm,
    nextAction,
    manualMoves,
    busy,
    error,
    success,
    dismissError: () => setError(null),
    reportError: (message: string) => setError(message),
    reportSuccess: (message: string) => setSuccess(message),
    actions,
  };
}
