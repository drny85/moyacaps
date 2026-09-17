# Hybrid Checkout and Subpath i18n Architecture

MoyaCaps implements a hybrid checkout model: automated credit/debit card processing via Stripe Checkout with Convex handling webhooks, alongside an itemized "Order via WhatsApp" direct flow for customers preferring alternative payment methods or direct communication. Guest checkout is enabled by default with Clerk authentication optional for customers and required for administrators. Internationalization uses Next.js subpath routing (`/en` and `/es`) via `next-intl` for localized SEO and social sharing.
