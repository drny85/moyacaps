export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://neat-condor-7184.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
