import { countryName } from "../i18n";

/** Where most pilgrims come from (ISO 3166-1), offered first; any other code can still be typed by the platform. */
const CODES = [
  "ID", "PK", "IN", "BD", "NG", "EG", "TR", "IR", "DZ", "MA", "MY", "SD", "IQ", "AF", "JO", "SY", "YE", "PS",
  "LB", "TN", "LY", "KW", "AE", "OM", "QA", "BH", "SN", "ML", "NE", "TD", "CM", "GH", "ET", "SO", "TZ", "KE",
  "UZ", "KZ", "TJ", "KG", "TM", "AZ", "RU", "CN", "PH", "TH", "LK", "MV", "BN", "SG", "BA", "AL", "GB", "FR",
  "DE", "NL", "BE", "SE", "US", "CA", "AU", "ZA",
];

/** Codes with their names in the reader's language, alphabetically by name. */
export const countryOptions = () =>
  CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
