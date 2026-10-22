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
import type * as analytics_migrations from "../analytics/migrations.js";
import type * as analytics_model from "../analytics/model.js";
import type * as analytics_orderStats from "../analytics/orderStats.js";
import type * as catalog_admin from "../catalog/admin.js";
import type * as catalog_audit from "../catalog/audit.js";
import type * as catalog_data from "../catalog/data.js";
import type * as catalog_dropAlertStats from "../catalog/dropAlertStats.js";
import type * as catalog_drops from "../catalog/drops.js";
import type * as catalog_history from "../catalog/history.js";
import type * as catalog_images_attach from "../catalog/images/attach.js";
import type * as catalog_images_cleanup from "../catalog/images/cleanup.js";
import type * as catalog_images_functions from "../catalog/images/functions.js";
import type * as catalog_images_header from "../catalog/images/header.js";
import type * as catalog_images_migration from "../catalog/images/migration.js";
import type * as catalog_images_overlay from "../catalog/images/overlay.js";
import type * as catalog_images_references from "../catalog/images/references.js";
import type * as catalog_images_rules from "../catalog/images/rules.js";
import type * as catalog_images_slots from "../catalog/images/slots.js";
import type * as catalog_images_validators from "../catalog/images/validators.js";
import type * as catalog_inventory from "../catalog/inventory.js";
import type * as catalog_migrations from "../catalog/migrations.js";
import type * as catalog_model from "../catalog/model.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as catalog_rules from "../catalog/rules.js";
import type * as catalog_shared from "../catalog/shared.js";
import type * as catalog_skuPlan from "../catalog/skuPlan.js";
import type * as catalog_stock from "../catalog/stock.js";
import type * as catalog_validators from "../catalog/validators.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_checkoutPass from "../lib/checkoutPass.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_storeTime from "../lib/storeTime.js";
import type * as notifications_adminRecipient from "../notifications/adminRecipient.js";
import type * as notifications_deliveryException from "../notifications/deliveryException.js";
import type * as notifications_emailEnv from "../notifications/emailEnv.js";
import type * as notifications_emails from "../notifications/emails.js";
import type * as notifications_launchAlerts from "../notifications/launchAlerts.js";
import type * as notifications_launchEmails from "../notifications/launchEmails.js";
import type * as notifications_orderEmails from "../notifications/orderEmails.js";
import type * as notifications_settings from "../notifications/settings.js";
import type * as notifications_signups from "../notifications/signups.js";
import type * as notifications_templates_AdminAlertEmail from "../notifications/templates/AdminAlertEmail.js";
import type * as notifications_templates_AdminDisputeAlert from "../notifications/templates/AdminDisputeAlert.js";
import type * as notifications_templates_AdminOrderAlert from "../notifications/templates/AdminOrderAlert.js";
import type * as notifications_templates_AdminTerritoryAlert from "../notifications/templates/AdminTerritoryAlert.js";
import type * as notifications_templates_CategoryLaunchEmail from "../notifications/templates/CategoryLaunchEmail.js";
import type * as notifications_templates_CustomerNoticeEmail from "../notifications/templates/CustomerNoticeEmail.js";
import type * as notifications_templates_CustomerReceipt from "../notifications/templates/CustomerReceipt.js";
import type * as notifications_templates_DeliveryExceptionEmail from "../notifications/templates/DeliveryExceptionEmail.js";
import type * as notifications_templates_OrderDeliveredEmail from "../notifications/templates/OrderDeliveredEmail.js";
import type * as notifications_templates_OrderDispatchedEmail from "../notifications/templates/OrderDispatchedEmail.js";
import type * as notifications_templates_ReviewInviteEmail from "../notifications/templates/ReviewInviteEmail.js";
import type * as notifications_templates_layout_BaseEmailLayout from "../notifications/templates/layout/BaseEmailLayout.js";
import type * as notifications_templates_layout_OrderSummary from "../notifications/templates/layout/OrderSummary.js";
import type * as notifications_templates_layout_brand from "../notifications/templates/layout/brand.js";
import type * as notifications_templates_layout_renderEmail from "../notifications/templates/layout/renderEmail.js";
import type * as notifications_templates_layout_strings from "../notifications/templates/layout/strings.js";
import type * as notifications_templates_layout_tokens from "../notifications/templates/layout/tokens.js";
import type * as notifications_unsubscribe from "../notifications/unsubscribe.js";
import type * as notifications_unsubscribeHttp from "../notifications/unsubscribeHttp.js";
import type * as orders_checkoutHold from "../orders/checkoutHold.js";
import type * as orders_desk from "../orders/desk.js";
import type * as orders_deskFilters from "../orders/deskFilters.js";
import type * as orders_fulfillment from "../orders/fulfillment.js";
import type * as orders_functions from "../orders/functions.js";
import type * as orders_guestClaim from "../orders/guestClaim.js";
import type * as orders_guestClaimModel from "../orders/guestClaimModel.js";
import type * as orders_handoff from "../orders/handoff.js";
import type * as orders_handoffs from "../orders/handoffs.js";
import type * as orders_labels from "../orders/labels.js";
import type * as orders_model from "../orders/model.js";
import type * as orders_paymentEvents from "../orders/paymentEvents.js";
import type * as orders_settlement from "../orders/settlement.js";
import type * as orders_shared from "../orders/shared.js";
import type * as orders_shippedNotice from "../orders/shippedNotice.js";
import type * as orders_status from "../orders/status.js";
import type * as orders_tracking from "../orders/tracking.js";
import type * as orders_trackingNumber from "../orders/trackingNumber.js";
import type * as orders_validators from "../orders/validators.js";
import type * as payments_checkout from "../payments/checkout.js";
import type * as payments_checkoutMetadata from "../payments/checkoutMetadata.js";
import type * as payments_checkoutModel from "../payments/checkoutModel.js";
import type * as payments_checkoutOrigin from "../payments/checkoutOrigin.js";
import type * as payments_checkoutRateLimit from "../payments/checkoutRateLimit.js";
import type * as payments_limits from "../payments/limits.js";
import type * as payments_refundFailureModel from "../payments/refundFailureModel.js";
import type * as payments_refundLedger from "../payments/refundLedger.js";
import type * as payments_refundModel from "../payments/refundModel.js";
import type * as payments_refunds from "../payments/refunds.js";
import type * as payments_settlementModel from "../payments/settlementModel.js";
import type * as payments_stripeClient from "../payments/stripeClient.js";
import type * as payments_webhook from "../payments/webhook.js";
import type * as reviews_admin from "../reviews/admin.js";
import type * as reviews_customer from "../reviews/customer.js";
import type * as reviews_invites from "../reviews/invites.js";
import type * as reviews_invitesHttp from "../reviews/invitesHttp.js";
import type * as reviews_model from "../reviews/model.js";
import type * as reviews_public from "../reviews/public.js";
import type * as reviews_shared from "../reviews/shared.js";
import type * as reviews_validators from "../reviews/validators.js";
import type * as settings_functions from "../settings/functions.js";
import type * as settings_homeTiles from "../settings/homeTiles.js";
import type * as settings_homeTilesModel from "../settings/homeTilesModel.js";
import type * as settings_launch from "../settings/launch.js";
import type * as settings_model from "../settings/model.js";
import type * as settings_revalidate from "../settings/revalidate.js";
import type * as shipping_functions from "../shipping/functions.js";
import type * as shipping_parcels from "../shipping/parcels.js";
import type * as shipping_pickupPlan from "../shipping/pickupPlan.js";
import type * as shipping_pickupQueries from "../shipping/pickupQueries.js";
import type * as shipping_pickups from "../shipping/pickups.js";
import type * as shipping_queries from "../shipping/queries.js";
import type * as shipping_shipFrom from "../shipping/shipFrom.js";
import type * as shipping_shippoClient from "../shipping/shippoClient.js";
import type * as shipping_shippoMode from "../shipping/shippoMode.js";
import type * as shipping_shippoWebhook from "../shipping/shippoWebhook.js";
import type * as shipping_territory from "../shipping/territory.js";
import type * as users_clerk from "../users/clerk.js";
import type * as users_clerkWebhook from "../users/clerkWebhook.js";
import type * as users_functions from "../users/functions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "analytics/functions": typeof analytics_functions;
  "analytics/migrations": typeof analytics_migrations;
  "analytics/model": typeof analytics_model;
  "analytics/orderStats": typeof analytics_orderStats;
  "catalog/admin": typeof catalog_admin;
  "catalog/audit": typeof catalog_audit;
  "catalog/data": typeof catalog_data;
  "catalog/dropAlertStats": typeof catalog_dropAlertStats;
  "catalog/drops": typeof catalog_drops;
  "catalog/history": typeof catalog_history;
  "catalog/images/attach": typeof catalog_images_attach;
  "catalog/images/cleanup": typeof catalog_images_cleanup;
  "catalog/images/functions": typeof catalog_images_functions;
  "catalog/images/header": typeof catalog_images_header;
  "catalog/images/migration": typeof catalog_images_migration;
  "catalog/images/overlay": typeof catalog_images_overlay;
  "catalog/images/references": typeof catalog_images_references;
  "catalog/images/rules": typeof catalog_images_rules;
  "catalog/images/slots": typeof catalog_images_slots;
  "catalog/images/validators": typeof catalog_images_validators;
  "catalog/inventory": typeof catalog_inventory;
  "catalog/migrations": typeof catalog_migrations;
  "catalog/model": typeof catalog_model;
  "catalog/queries": typeof catalog_queries;
  "catalog/rules": typeof catalog_rules;
  "catalog/shared": typeof catalog_shared;
  "catalog/skuPlan": typeof catalog_skuPlan;
  "catalog/stock": typeof catalog_stock;
  "catalog/validators": typeof catalog_validators;
  crons: typeof crons;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/checkoutPass": typeof lib_checkoutPass;
  "lib/functions": typeof lib_functions;
  "lib/ids": typeof lib_ids;
  "lib/secrets": typeof lib_secrets;
  "lib/storeTime": typeof lib_storeTime;
  "notifications/adminRecipient": typeof notifications_adminRecipient;
  "notifications/deliveryException": typeof notifications_deliveryException;
  "notifications/emailEnv": typeof notifications_emailEnv;
  "notifications/emails": typeof notifications_emails;
  "notifications/launchAlerts": typeof notifications_launchAlerts;
  "notifications/launchEmails": typeof notifications_launchEmails;
  "notifications/orderEmails": typeof notifications_orderEmails;
  "notifications/settings": typeof notifications_settings;
  "notifications/signups": typeof notifications_signups;
  "notifications/templates/AdminAlertEmail": typeof notifications_templates_AdminAlertEmail;
  "notifications/templates/AdminDisputeAlert": typeof notifications_templates_AdminDisputeAlert;
  "notifications/templates/AdminOrderAlert": typeof notifications_templates_AdminOrderAlert;
  "notifications/templates/AdminTerritoryAlert": typeof notifications_templates_AdminTerritoryAlert;
  "notifications/templates/CategoryLaunchEmail": typeof notifications_templates_CategoryLaunchEmail;
  "notifications/templates/CustomerNoticeEmail": typeof notifications_templates_CustomerNoticeEmail;
  "notifications/templates/CustomerReceipt": typeof notifications_templates_CustomerReceipt;
  "notifications/templates/DeliveryExceptionEmail": typeof notifications_templates_DeliveryExceptionEmail;
  "notifications/templates/OrderDeliveredEmail": typeof notifications_templates_OrderDeliveredEmail;
  "notifications/templates/OrderDispatchedEmail": typeof notifications_templates_OrderDispatchedEmail;
  "notifications/templates/ReviewInviteEmail": typeof notifications_templates_ReviewInviteEmail;
  "notifications/templates/layout/BaseEmailLayout": typeof notifications_templates_layout_BaseEmailLayout;
  "notifications/templates/layout/OrderSummary": typeof notifications_templates_layout_OrderSummary;
  "notifications/templates/layout/brand": typeof notifications_templates_layout_brand;
  "notifications/templates/layout/renderEmail": typeof notifications_templates_layout_renderEmail;
  "notifications/templates/layout/strings": typeof notifications_templates_layout_strings;
  "notifications/templates/layout/tokens": typeof notifications_templates_layout_tokens;
  "notifications/unsubscribe": typeof notifications_unsubscribe;
  "notifications/unsubscribeHttp": typeof notifications_unsubscribeHttp;
  "orders/checkoutHold": typeof orders_checkoutHold;
  "orders/desk": typeof orders_desk;
  "orders/deskFilters": typeof orders_deskFilters;
  "orders/fulfillment": typeof orders_fulfillment;
  "orders/functions": typeof orders_functions;
  "orders/guestClaim": typeof orders_guestClaim;
  "orders/guestClaimModel": typeof orders_guestClaimModel;
  "orders/handoff": typeof orders_handoff;
  "orders/handoffs": typeof orders_handoffs;
  "orders/labels": typeof orders_labels;
  "orders/model": typeof orders_model;
  "orders/paymentEvents": typeof orders_paymentEvents;
  "orders/settlement": typeof orders_settlement;
  "orders/shared": typeof orders_shared;
  "orders/shippedNotice": typeof orders_shippedNotice;
  "orders/status": typeof orders_status;
  "orders/tracking": typeof orders_tracking;
  "orders/trackingNumber": typeof orders_trackingNumber;
  "orders/validators": typeof orders_validators;
  "payments/checkout": typeof payments_checkout;
  "payments/checkoutMetadata": typeof payments_checkoutMetadata;
  "payments/checkoutModel": typeof payments_checkoutModel;
  "payments/checkoutOrigin": typeof payments_checkoutOrigin;
  "payments/checkoutRateLimit": typeof payments_checkoutRateLimit;
  "payments/limits": typeof payments_limits;
  "payments/refundFailureModel": typeof payments_refundFailureModel;
  "payments/refundLedger": typeof payments_refundLedger;
  "payments/refundModel": typeof payments_refundModel;
  "payments/refunds": typeof payments_refunds;
  "payments/settlementModel": typeof payments_settlementModel;
  "payments/stripeClient": typeof payments_stripeClient;
  "payments/webhook": typeof payments_webhook;
  "reviews/admin": typeof reviews_admin;
  "reviews/customer": typeof reviews_customer;
  "reviews/invites": typeof reviews_invites;
  "reviews/invitesHttp": typeof reviews_invitesHttp;
  "reviews/model": typeof reviews_model;
  "reviews/public": typeof reviews_public;
  "reviews/shared": typeof reviews_shared;
  "reviews/validators": typeof reviews_validators;
  "settings/functions": typeof settings_functions;
  "settings/homeTiles": typeof settings_homeTiles;
  "settings/homeTilesModel": typeof settings_homeTilesModel;
  "settings/launch": typeof settings_launch;
  "settings/model": typeof settings_model;
  "settings/revalidate": typeof settings_revalidate;
  "shipping/functions": typeof shipping_functions;
  "shipping/parcels": typeof shipping_parcels;
  "shipping/pickupPlan": typeof shipping_pickupPlan;
  "shipping/pickupQueries": typeof shipping_pickupQueries;
  "shipping/pickups": typeof shipping_pickups;
  "shipping/queries": typeof shipping_queries;
  "shipping/shipFrom": typeof shipping_shipFrom;
  "shipping/shippoClient": typeof shipping_shippoClient;
  "shipping/shippoMode": typeof shipping_shippoMode;
  "shipping/shippoWebhook": typeof shipping_shippoWebhook;
  "shipping/territory": typeof shipping_territory;
  "users/clerk": typeof users_clerk;
  "users/clerkWebhook": typeof users_clerkWebhook;
  "users/functions": typeof users_functions;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  orderStats: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"orderStats">;
  dropAlertStats: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"dropAlertStats">;
};
