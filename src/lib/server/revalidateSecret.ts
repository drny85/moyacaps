/** Shared-secret check for `/api/revalidate` (ADR 0022); the constant-time compare lives in Convex's lib. */
export { isValidSharedSecret as isValidRevalidateSecret } from "../../../convex/lib/secrets";
