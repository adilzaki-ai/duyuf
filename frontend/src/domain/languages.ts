/**
 * Languages an operator is likely to hire interpreters for (ISO 639-1),
 * roughly by how many pilgrims speak them. Arabic and English are left out:
 * the desk speaks those.
 */
export const INTERPRETER_LANGUAGES = [
  "ur", "id", "bn", "tr", "ms", "ha", "fa", "fr", "ru", "uz", "ps", "so", "sw", "yo", "ta", "hi",
] as const;
