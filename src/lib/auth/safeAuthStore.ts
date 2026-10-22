import { createStore } from "zustand/vanilla";

/**
 * The storefront's view of Clerk (ADR 0018). Clerk mounts lazily in `ClerkRuntime`,
 * outside the page tree, and reports here; everything else reads this store through
 * `useSafeUser` and never imports `@clerk/nextjs`. That keeps Clerk's ~150 KB of
 * bindings and the clerk-js CDN bundle off pages that do not need a session.
 */

export interface SignInOptions {
  mode?: "modal" | "redirect";
  /** Which Clerk form opens first; the Account Invite opens sign-up */
  flow?: "signIn" | "signUp";
  /** Prefills the form, e.g. with the checkout email so the guest Order is claimed (ADR 0026) */
  emailAddress?: string;
  forceRedirectUrl?: string;
  fallbackRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
  signUpFallbackRedirectUrl?: string;
}

export interface GetTokenOptions {
  template?: string;
  skipCache?: boolean;
}

/** Session snapshot pushed by ClerkRuntime from Clerk's own hooks */
export interface ClerkSession {
  isLoaded: boolean;
  isSignedIn: boolean;
  /** Clerk UserResource (kept loose, like the rest of the app's user handling) */
  user: any;
  sessionId: string | null;
  orgId: string | null;
  orgRole: string | null;
  /** `aud` claim of the session token; "convex" when the session token is the Convex JWT */
  tokenAudience: string | null;
  getToken: (options?: GetTokenOptions) => Promise<string | null>;
}

type ClerkCallOptions = Omit<SignInOptions, "mode" | "flow">;

/** Imperative Clerk calls, registered by ClerkRuntime once the provider mounts */
export interface ClerkActions {
  openSignIn: (options: ClerkCallOptions) => void;
  redirectToSignIn: (options: ClerkCallOptions) => void;
  openSignUp: (options: ClerkCallOptions) => void;
  redirectToSignUp: (options: ClerkCallOptions) => void;
}

export interface SafeAuthState {
  /** NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set */
  enabled: boolean;
  /** ClerkRuntime should be mounted (stays true once set) */
  requested: boolean;
  /** A Clerk cookie says the visitor is probably signed in */
  hinted: boolean;
  session: ClerkSession | null;
  actions: ClerkActions | null;
  /** Sign-in asked for before Clerk loaded; opened once the session is known */
  pendingSignIn: SignInOptions | null;
  /** DOM nodes where ClerkRuntime portals a UserButton */
  userButtonSlots: HTMLElement[];

  load: () => void;
  setHinted: (hinted: boolean) => void;
  signIn: (options?: SignInOptions) => void;
  attach: (actions: ClerkActions) => void;
  setSession: (session: ClerkSession) => void;
  registerUserButtonSlot: (el: HTMLElement) => () => void;
}

function runSignIn(actions: ClerkActions, { mode = "modal", flow = "signIn", ...options }: SignInOptions) {
  if (flow === "signUp") {
    if (mode === "modal") actions.openSignUp(options);
    else actions.redirectToSignUp(options);
    return;
  }
  if (mode === "modal") actions.openSignIn(options);
  else actions.redirectToSignIn(options);
}

export function createSafeAuthStore(enabled: boolean) {
  return createStore<SafeAuthState>()((set, get) => ({
    enabled,
    requested: false,
    hinted: false,
    session: null,
    actions: null,
    pendingSignIn: null,
    userButtonSlots: [],

    load: () => {
      if (get().enabled && !get().requested) set({ requested: true });
    },

    setHinted: (hinted) => set({ hinted }),

    signIn: (options = {}) => {
      const { enabled, actions, session } = get();
      if (!enabled) return;
      if (actions && session?.isLoaded) {
        if (!session.isSignedIn) runSignIn(actions, options);
        return;
      }
      // Clerk not ready yet: remember the request and start loading it
      set({ pendingSignIn: options, requested: true });
    },

    attach: (actions) => set({ actions }),

    setSession: (session) => {
      const { pendingSignIn, actions } = get();
      if (pendingSignIn && actions && session.isLoaded) {
        set({ session, pendingSignIn: null });
        // The cookie hint can be stale; a signed-in visitor gets no sign-in modal
        if (!session.isSignedIn) runSignIn(actions, pendingSignIn);
        return;
      }
      set({ session });
    },

    registerUserButtonSlot: (el) => {
      set({ userButtonSlots: [...get().userButtonSlots, el] });
      return () => set({ userButtonSlots: get().userButtonSlots.filter((slot) => slot !== el) });
    },
  }));
}

export type SafeAuthStore = ReturnType<typeof createSafeAuthStore>;

export const safeAuthStore = createSafeAuthStore(Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY));

export interface SafeUserView {
  user: any;
  isLoaded: boolean;
  isSignedIn: boolean;
}

/**
 * What `useSafeUser` returns. Until Clerk reports, a visitor we expect to have a
 * session (auth route, cookie hint, or Clerk already loading) is "not loaded yet";
 * an anonymous visitor on a public page is "loaded, signed out".
 */
export function safeUserView(
  state: Pick<SafeAuthState, "enabled" | "requested" | "hinted" | "session">,
  { routeNeedsClerk }: { routeNeedsClerk: boolean }
): SafeUserView {
  if (!state.enabled) return { user: null, isLoaded: true, isSignedIn: false };
  if (state.session?.isLoaded) {
    return {
      user: state.session.isSignedIn ? state.session.user ?? null : null,
      isLoaded: true,
      isSignedIn: state.session.isSignedIn,
    };
  }
  const waiting = routeNeedsClerk || state.hinted || state.requested;
  return { user: null, isLoaded: !waiting, isSignedIn: false };
}

/** Same rule for Convex's auth state (ConvexProviderWithAuth) */
export function convexAuthView(
  state: Pick<SafeAuthState, "enabled" | "requested" | "hinted" | "session">,
  context: { routeNeedsClerk: boolean }
): { isLoading: boolean; isAuthenticated: boolean } {
  const view = safeUserView(state, context);
  return { isLoading: !view.isLoaded, isAuthenticated: view.isSignedIn };
}

/** Convex JWT for the session, mirroring convex/react-clerk's ConvexProviderWithClerk */
export async function fetchConvexToken(
  session: ClerkSession | null,
  { forceRefreshToken }: { forceRefreshToken: boolean }
): Promise<string | null> {
  if (!session?.isSignedIn) return null;
  try {
    return session.tokenAudience === "convex"
      ? await session.getToken({ skipCache: forceRefreshToken })
      : await session.getToken({ template: "convex", skipCache: forceRefreshToken });
  } catch {
    return null;
  }
}
