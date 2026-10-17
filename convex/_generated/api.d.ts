/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as analyticsModel from "../analyticsModel.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as catalogAdmin from "../catalogAdmin.js";
import type * as catalogData from "../catalogData.js";
import type * as catalogMigrations from "../catalogMigrations.js";
import type * as catalogModel from "../catalogModel.js";
import type * as catalogShared from "../catalogShared.js";
import type * as catalogValidators from "../catalogValidators.js";
import type * as checkoutMetadata from "../checkoutMetadata.js";
import type * as checkoutModel from "../checkoutModel.js";
import type * as crons from "../crons.js";
import type * as drops from "../drops.js";
import type * as emails from "../emails.js";
import type * as emails_AdminDisputeAlert from "../emails/AdminDisputeAlert.js";
import type * as emails_AdminOrderAlert from "../emails/AdminOrderAlert.js";
import type * as emails_CustomerReceipt from "../emails/CustomerReceipt.js";
import type * as emails_OrderDeliveredEmail from "../emails/OrderDeliveredEmail.js";
import type * as emails_OrderDispatchedEmail from "../emails/OrderDispatchedEmail.js";
import type * as http from "../http.js";
import type * as ids from "../ids.js";
import type * as inventory from "../inventory.js";
import type * as orderDesk from "../orderDesk.js";
import type * as orderFulfillment from "../orderFulfillment.js";
import type * as orderModel from "../orderModel.js";
import type * as orderSettlement from "../orderSettlement.js";
import type * as orderShared from "../orderShared.js";
import type * as orderValidators from "../orderValidators.js";
import type * as orders from "../orders.js";
import type * as reservationModel from "../reservationModel.js";
import type * as shipping from "../shipping.js";
import type * as stripeCheckout from "../stripeCheckout.js";
import type * as stripeClient from "../stripeClient.js";
import type * as stripeRefunds from "../stripeRefunds.js";
import type * as stripeSettlementModel from "../stripeSettlementModel.js";
import type * as stripeWebhook from "../stripeWebhook.js";
import type * as trackingModel from "../trackingModel.js";
import type * as users from "../users.js";
import type * as whatsappOrders from "../whatsappOrders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  analyticsModel: typeof analyticsModel;
  auth: typeof auth;
  catalog: typeof catalog;
  catalogAdmin: typeof catalogAdmin;
  catalogData: typeof catalogData;
  catalogMigrations: typeof catalogMigrations;
  catalogModel: typeof catalogModel;
  catalogShared: typeof catalogShared;
  catalogValidators: typeof catalogValidators;
  checkoutMetadata: typeof checkoutMetadata;
  checkoutModel: typeof checkoutModel;
  crons: typeof crons;
  drops: typeof drops;
  emails: typeof emails;
  "emails/AdminDisputeAlert": typeof emails_AdminDisputeAlert;
  "emails/AdminOrderAlert": typeof emails_AdminOrderAlert;
  "emails/CustomerReceipt": typeof emails_CustomerReceipt;
  "emails/OrderDeliveredEmail": typeof emails_OrderDeliveredEmail;
  "emails/OrderDispatchedEmail": typeof emails_OrderDispatchedEmail;
  http: typeof http;
  ids: typeof ids;
  inventory: typeof inventory;
  orderDesk: typeof orderDesk;
  orderFulfillment: typeof orderFulfillment;
  orderModel: typeof orderModel;
  orderSettlement: typeof orderSettlement;
  orderShared: typeof orderShared;
  orderValidators: typeof orderValidators;
  orders: typeof orders;
  reservationModel: typeof reservationModel;
  shipping: typeof shipping;
  stripeCheckout: typeof stripeCheckout;
  stripeClient: typeof stripeClient;
  stripeRefunds: typeof stripeRefunds;
  stripeSettlementModel: typeof stripeSettlementModel;
  stripeWebhook: typeof stripeWebhook;
  trackingModel: typeof trackingModel;
  users: typeof users;
  whatsappOrders: typeof whatsappOrders;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
