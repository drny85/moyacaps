import { describe, expect, it, vi } from "vitest";
import { clerkLoadTrigger, hasSignedInHint, routeNeedsClerk } from "../lib/auth/clerkLoadPolicy";
import {
  convexAuthView,
  createSafeAuthStore,
  fetchConvexToken,
  safeUserView,
  type ClerkActions,
  type ClerkSession,
} from "../lib/auth/safeAuthStore";

const session = (over: Partial<ClerkSession> = {}): ClerkSession => ({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  sessionId: null,
  orgId: null,
  orgRole: null,
  tokenAudience: null,
  getToken: async () => "jwt",
  ...over,
});

const actions = () => ({
  openSignIn: vi.fn<ClerkActions["openSignIn"]>(),
  redirectToSignIn: vi.fn<ClerkActions["redirectToSignIn"]>(),
  openSignUp: vi.fn<ClerkActions["openSignUp"]>(),
  redirectToSignUp: vi.fn<ClerkActions["redirectToSignUp"]>(),
});

describe("routeNeedsClerk", () => {
  it.each([
    ["/en/checkout", true],
    ["/es/checkout/success", true],
    ["/en/account/orders", true],
    ["/en/admin", true],
    ["/admin/orders/GL-1", true],
    ["/checkout", true],
    ["/en", false],
    ["/en/products", false],
    ["/en/products/negro-rojo", false],
    ["/en/track", false],
    ["/en/checkouts-guide", false],
    ["/", false],
  ])("%s → %s", (path, expected) => {
    expect(routeNeedsClerk(path)).toBe(expected);
  });
});

describe("hasSignedInHint", () => {
  it("reads a positive __client_uat as a likely session", () => {
    expect(hasSignedInHint("theme=dark; __client_uat=1760000000")).toBe(true);
    expect(hasSignedInHint("__client_uat_Xyz12=1760000000; other=1")).toBe(true);
  });

  it("treats 0, missing or unrelated cookies as signed out", () => {
    expect(hasSignedInHint("__client_uat=0")).toBe(false);
    expect(hasSignedInHint("")).toBe(false);
    expect(hasSignedInHint("my__client_uat=5; __client_uatx=5")).toBe(false);
  });
});

describe("clerkLoadTrigger", () => {
  it("loads now on auth routes, after idle for returning visitors, on intent otherwise", () => {
    expect(clerkLoadTrigger({ pathname: "/en/checkout", cookie: "" })).toBe("now");
    expect(clerkLoadTrigger({ pathname: "/en", cookie: "__client_uat=1760000000" })).toBe("idle");
    expect(clerkLoadTrigger({ pathname: "/en", cookie: "__client_uat=0" })).toBe("interaction");
  });
});

describe("safeUserView", () => {
  const base = { enabled: true, requested: false, hinted: false, session: null };

  it("reports an anonymous visitor on a public page as loaded and signed out", () => {
    expect(safeUserView(base, { routeNeedsClerk: false })).toEqual({ user: null, isLoaded: true, isSignedIn: false });
  });

  it("waits for Clerk on auth routes, with a cookie hint, or while Clerk loads", () => {
    expect(safeUserView(base, { routeNeedsClerk: true }).isLoaded).toBe(false);
    expect(safeUserView({ ...base, hinted: true }, { routeNeedsClerk: false }).isLoaded).toBe(false);
    expect(safeUserView({ ...base, requested: true }, { routeNeedsClerk: false }).isLoaded).toBe(false);
  });

  it("passes Clerk's answer through once loaded", () => {
    const user = { id: "user_1" };
    const view = safeUserView({ ...base, session: session({ isSignedIn: true, user }) }, { routeNeedsClerk: true });
    expect(view).toEqual({ user, isLoaded: true, isSignedIn: true });
  });

  it("is always loaded and signed out without a Clerk key", () => {
    expect(safeUserView({ ...base, enabled: false }, { routeNeedsClerk: true })).toEqual({
      user: null,
      isLoaded: true,
      isSignedIn: false,
    });
  });

  it("gives Convex the same answer", () => {
    expect(convexAuthView(base, { routeNeedsClerk: true })).toEqual({ isLoading: true, isAuthenticated: false });
    expect(
      convexAuthView({ ...base, session: session({ isSignedIn: true }) }, { routeNeedsClerk: false })
    ).toEqual({ isLoading: false, isAuthenticated: true });
  });
});

describe("safeAuthStore", () => {
  it("does nothing without a Clerk key", () => {
    const store = createSafeAuthStore(false);
    store.getState().load();
    store.getState().signIn();
    expect(store.getState().requested).toBe(false);
    expect(store.getState().pendingSignIn).toBeNull();
  });

  it("queues a sign-in before Clerk loads, requests the load, and opens the modal once signed out is confirmed", () => {
    const store = createSafeAuthStore(true);
    const clerk = actions();
    store.getState().signIn({ mode: "modal", forceRedirectUrl: "/en/checkout" });
    expect(store.getState().requested).toBe(true);

    store.getState().attach(clerk);
    store.getState().setSession(session({ isLoaded: false }));
    expect(clerk.openSignIn).not.toHaveBeenCalled();

    store.getState().setSession(session());
    expect(clerk.openSignIn).toHaveBeenCalledWith({ forceRedirectUrl: "/en/checkout" });
    expect(store.getState().pendingSignIn).toBeNull();
  });

  it("drops a queued sign-in when the visitor turns out to be signed in", () => {
    const store = createSafeAuthStore(true);
    const clerk = actions();
    store.getState().signIn();
    store.getState().attach(clerk);
    store.getState().setSession(session({ isSignedIn: true }));
    expect(clerk.openSignIn).not.toHaveBeenCalled();
    expect(store.getState().pendingSignIn).toBeNull();
  });

  it("signs in directly once Clerk is ready, by modal or redirect", () => {
    const store = createSafeAuthStore(true);
    const clerk = actions();
    store.getState().attach(clerk);
    store.getState().setSession(session());
    store.getState().signIn({ mode: "redirect", fallbackRedirectUrl: "/en" });
    expect(clerk.redirectToSignIn).toHaveBeenCalledWith({ fallbackRedirectUrl: "/en" });
    store.getState().signIn();
    expect(clerk.openSignIn).toHaveBeenCalledWith({});
  });

  it("opens sign-up instead when asked, passing the prefilled email through", () => {
    const store = createSafeAuthStore(true);
    const clerk = actions();
    store.getState().signIn({ flow: "signUp", emailAddress: "ana@example.com", forceRedirectUrl: "/en/account/orders" });
    store.getState().attach(clerk);
    store.getState().setSession(session());
    expect(clerk.openSignUp).toHaveBeenCalledWith({ emailAddress: "ana@example.com", forceRedirectUrl: "/en/account/orders" });
    expect(clerk.openSignIn).not.toHaveBeenCalled();

    store.getState().signIn({ flow: "signUp", mode: "redirect" });
    expect(clerk.redirectToSignUp).toHaveBeenCalledWith({});
  });

  it("tracks UserButton slots", () => {
    const store = createSafeAuthStore(true);
    const a = {} as HTMLElement;
    const b = {} as HTMLElement;
    const unregisterA = store.getState().registerUserButtonSlot(a);
    store.getState().registerUserButtonSlot(b);
    unregisterA();
    expect(store.getState().userButtonSlots).toEqual([b]);
  });
});

describe("fetchConvexToken", () => {
  it("uses the convex JWT template unless the session token already targets Convex", async () => {
    const getToken = vi.fn(async () => "jwt");
    await fetchConvexToken(session({ isSignedIn: true, getToken }), { forceRefreshToken: true });
    expect(getToken).toHaveBeenLastCalledWith({ template: "convex", skipCache: true });
    await fetchConvexToken(session({ isSignedIn: true, getToken, tokenAudience: "convex" }), { forceRefreshToken: false });
    expect(getToken).toHaveBeenLastCalledWith({ skipCache: false });
  });

  it("returns null when signed out or when Clerk throws", async () => {
    expect(await fetchConvexToken(null, { forceRefreshToken: false })).toBeNull();
    const failing = session({ isSignedIn: true, getToken: async () => Promise.reject(new Error("offline")) });
    expect(await fetchConvexToken(failing, { forceRefreshToken: false })).toBeNull();
  });
});
