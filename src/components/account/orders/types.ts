import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** One Order as the account page receives it (confirmed purchases only). */
export type CustomerOrder = FunctionReturnType<typeof api.orders.functions.getOrdersByClerkId>[number];
