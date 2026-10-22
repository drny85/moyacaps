/** What the order confirmation page offers about accounts. */
export type ConfirmationAccountOffer = "none" | "viewOrders" | "accountInvite";

/**
 * Nothing until Clerk answers (no flash of the wrong card), "View orders" for a signed-in
 * Customer, whose checkout already owns the Order, and the Account Invite for everyone else.
 */
export function confirmationAccountOffer({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}): ConfirmationAccountOffer {
  if (!isLoaded) return "none";
  return isSignedIn ? "viewOrders" : "accountInvite";
}

/**
 * Where sign-up or sign-in from the Account Invite lands. The guest Order is claimed by the
 * verified email when the account syncs (ADR 0026), so it shows up in the list there.
 */
export function accountOrdersPath(locale: string): string {
  return `/${locale}/account/orders`;
}
