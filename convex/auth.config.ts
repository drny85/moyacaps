import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Clerk Frontend API URL (issuer). Set per deployment: dev and prod use different Clerk instances.
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
