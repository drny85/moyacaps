/**
 * United States Postal States, Territories & Validation Helpers
 */

export interface UsState {
  code: string;
  name: string;
}

export const US_STATES: UsState[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

/**
 * Formats a raw phone input string as (XXX) XXX-XXXX for US domestic numbers.
 */
export function formatUsPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;

  if (normalized.length === 0) return "";
  if (normalized.length <= 3) return `(${normalized}`;
  if (normalized.length <= 6) return `(${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
}

/**
 * Capitalizes the first letter of each word (e.g. "123 main street" -> "123 Main Street").
 * Preserves existing uppercase abbreviations (e.g. "NW", "SW").
 */
export function capitalizeWords(str: string): string {
  if (!str) return "";
  return str.replace(/\b([a-z])/g, (char) => char.toUpperCase());
}

/**
 * Validates a 5-digit US ZIP code (or ZIP+4).
 */
export function isValidUsZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/**
 * Validates complete US domestic shipping address fields.
 */
export interface UsAddressValidationInput {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  locale?: string;
}

export function validateUsAddress({
  name,
  phone,
  line1,
  city,
  state,
  postalCode,
  locale = "en",
}: UsAddressValidationInput): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const isEs = locale === "es";
  const errors: Record<string, string> = {};

  const cleanName = name.trim();
  if (!cleanName || cleanName.length < 2) {
    errors.name = isEs ? "Ingresa tu nombre completo" : "Please enter your full name";
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const normalizedPhone = phoneDigits.startsWith("1") && phoneDigits.length === 11 ? phoneDigits.slice(1) : phoneDigits;
  if (normalizedPhone.length !== 10) {
    errors.phone = isEs
      ? "Ingresa un número válido de 10 dígitos (EE.UU.)"
      : "Must be a valid 10-digit US phone number";
  }

  const cleanLine1 = line1.trim();
  if (!cleanLine1 || cleanLine1.length < 5) {
    errors.line1 = isEs
      ? "Ingresa calle y número de entrega"
      : "Please enter a valid street address and number";
  } else if (!/\d+/.test(cleanLine1) || !/[a-zA-Z]/.test(cleanLine1)) {
    errors.line1 = isEs
      ? "Incluye número y nombre de calle (ej. 123 Main St)"
      : "Must include a street number and name (e.g. 123 Main St)";
  }

  const cleanCity = city.trim();
  if (!cleanCity || cleanCity.length < 2 || !/^[a-zA-Z\s.'-]+$/.test(cleanCity)) {
    errors.city = isEs ? "Ingresa una ciudad válida" : "Please enter a valid city";
  }

  const cleanState = state.trim().toUpperCase();
  const validState = US_STATES.some((s) => s.code === cleanState);
  if (!validState) {
    errors.state = isEs ? "Selecciona un estado de EE.UU." : "Please select a US state";
  }

  if (!isValidUsZip(postalCode)) {
    errors.postalCode = isEs
      ? "Código postal inválido (ej. 90001)"
      : "Must be a valid 5-digit ZIP (e.g. 90001)";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
