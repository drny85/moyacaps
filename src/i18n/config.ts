import { defineRouting } from "next-intl/routing";

/** Locale config without navigation helpers, so pure modules (and tests) can import it. */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
});
