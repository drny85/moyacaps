# Clerk to Convex User Synchronization Architecture

To mirror identity, contact, and authorization metadata from Clerk into the primary database without operational lag, we implemented a hybrid three-tier synchronization strategy:

1. **Client Just-In-Time (JIT) Sync (`UserSyncProvider` & `syncCurrentUser`):** Authenticated client sessions automatically upsert their user profile document to Convex upon mounting, ensuring zero delay for customers and admins interacting with the application.
2. **Asynchronous Webhook Sync (`/clerk-users-webhook` & Svix):** Incoming `user.created`, `user.updated`, and `user.deleted` events from Clerk are cryptographically verified with Svix and processed in Convex HTTP actions. Deleted Clerk accounts trigger non-destructive soft deletions (`deletedAt` timestamp) to retain full historical integrity for financial orders and audit ledgers.
3. **One-Click Backfill CLI (`scripts/sync-users.ts`):** Direct server-to-server batch migration script synchronizing existing Clerk users to Convex with role reconciliation (`admin` designation for `drny85@gmail.com`).
