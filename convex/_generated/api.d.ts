/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics_functions from "../analytics/functions.js";
import type * as analytics_model from "../analytics/model.js";
import type * as catalog_admin from "../catalog/admin.js";
import type * as catalog_audit from "../catalog/audit.js";
import type * as catalog_data from "../catalog/data.js";
import type * as catalog_drops from "../catalog/drops.js";
import type * as catalog_history from "../catalog/history.js";
import type * as catalog_inventory from "../catalog/inventory.js";
import type * as catalog_migrations from "../catalog/migrations.js";
import type * as catalog_model from "../catalog/model.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as catalog_reservations from "../catalog/reservations.js";
import type * as catalog_rules from "../catalog/rules.js";
import type * as catalog_shared from "../catalog/shared.js";
import type * as catalog_validators from "../catalog/validators.js";
import type * as crons from "../crons.js";
import type * as drops from "../drops.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_ids from "../lib/ids.js";
import type * as notifications_emails from "../notifications/emails.js";
import type * as notifications_templates_AdminDisputeAlert from "../notifications/templates/AdminDisputeAlert.js";
import type * as notifications_templates_AdminOrderAlert from "../notifications/templates/AdminOrderAlert.js";
import type * as notifications_templates_CustomerReceipt from "../notifications/templates/CustomerReceipt.js";
import type * as notifications_templates_OrderDeliveredEmail from "../notifications/templates/OrderDeliveredEmail.js";
import type * as notifications_templates_OrderDispatchedEmail from "../notifications/templates/OrderDispatchedEmail.js";
import type * as orders_desk from "../orders/desk.js";
import type * as orders_fulfillment from "../orders/fulfillment.js";
import type * as orders_functions from "../orders/functions.js";
import type * as orders_model from "../orders/model.js";
import type * as orders_settlement from "../orders/settlement.js";
import type * as orders_shared from "../orders/shared.js";
import type * as orders_tracking from "../orders/tracking.js";
import type * as orders_validators from "../orders/validators.js";
import type * as orders_whatsapp from "../orders/whatsapp.js";
import type * as payments_checkout from "../payments/checkout.js";
import type * as payments_checkoutMetadata from "../payments/checkoutMetadata.js";
import type * as payments_checkoutModel from "../payments/checkoutModel.js";
import type * as payments_refunds from "../payments/refunds.js";
import type * as payments_settlementModel from "../payments/settlementModel.js";
import type * as payments_stripeClient from "../payments/stripeClient.js";
import type * as payments_webhook from "../payments/webhook.js";
import type * as shipping_functions from "../shipping/functions.js";
import type * as stripeCheckout from "../stripeCheckout.js";
import type * as users_clerk from "../users/clerk.js";
import type * as users_clerkWebhook from "../users/clerkWebhook.js";
import type * as users_functions from "../users/functions.js";
import type * as whatsappOrders from "../whatsappOrders.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "analytics/functions": typeof analytics_functions;
  "analytics/model": typeof analytics_model;
  "catalog/admin": typeof catalog_admin;
  "catalog/audit": typeof catalog_audit;
  "catalog/data": typeof catalog_data;
  "catalog/drops": typeof catalog_drops;
  "catalog/history": typeof catalog_history;
  "catalog/inventory": typeof catalog_inventory;
  "catalog/migrations": typeof catalog_migrations;
  "catalog/model": typeof catalog_model;
  "catalog/queries": typeof catalog_queries;
  "catalog/reservations": typeof catalog_reservations;
  "catalog/rules": typeof catalog_rules;
  "catalog/shared": typeof catalog_shared;
  "catalog/validators": typeof catalog_validators;
  crons: typeof crons;
  drops: typeof drops;
  emails: typeof emails;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/ids": typeof lib_ids;
  "notifications/emails": typeof notifications_emails;
  "notifications/templates/AdminDisputeAlert": typeof notifications_templates_AdminDisputeAlert;
  "notifications/templates/AdminOrderAlert": typeof notifications_templates_AdminOrderAlert;
  "notifications/templates/CustomerReceipt": typeof notifications_templates_CustomerReceipt;
  "notifications/templates/OrderDeliveredEmail": typeof notifications_templates_OrderDeliveredEmail;
  "notifications/templates/OrderDispatchedEmail": typeof notifications_templates_OrderDispatchedEmail;
  "orders/desk": typeof orders_desk;
  "orders/fulfillment": typeof orders_fulfillment;
  "orders/functions": typeof orders_functions;
  "orders/model": typeof orders_model;
  "orders/settlement": typeof orders_settlement;
  "orders/shared": typeof orders_shared;
  "orders/tracking": typeof orders_tracking;
  "orders/validators": typeof orders_validators;
  "orders/whatsapp": typeof orders_whatsapp;
  "payments/checkout": typeof payments_checkout;
  "payments/checkoutMetadata": typeof payments_checkoutMetadata;
  "payments/checkoutModel": typeof payments_checkoutModel;
  "payments/refunds": typeof payments_refunds;
  "payments/settlementModel": typeof payments_settlementModel;
  "payments/stripeClient": typeof payments_stripeClient;
  "payments/webhook": typeof payments_webhook;
  "shipping/functions": typeof shipping_functions;
  stripeCheckout: typeof stripeCheckout;
  "users/clerk": typeof users_clerk;
  "users/clerkWebhook": typeof users_clerkWebhook;
  "users/functions": typeof users_functions;
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
