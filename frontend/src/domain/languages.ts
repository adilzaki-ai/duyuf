/**
 * Languages an operator is likely to hire interpreters for (ISO 639-1),
 * roughly by how many pilgrims speak them. Arabic and English are left out:
 * the desk speaks those.
 */
export const INTERPRETER_LANGUAGES = [
  "ur", "id", "bn", "tr", "ms", "ha", "fa", "fr", "ru", "uz", "ps", "so", "sw", "yo", "ta", "hi",
] as const;

/** Any language a pilgrim may speak: Arabic and English first, then the rest. */
export const PILGRIM_LANGUAGES = ["ar", "en", ...INTERPRETER_LANGUAGES] as const;
