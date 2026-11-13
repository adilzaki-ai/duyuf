"""What a pilgrim can ask for on Rafeeq, and in which languages.

The front end holds the same tables (frontend/src/rafeeq/help.ts) so the page
only offers what the platform will take; a test there reads this file.
"""
from __future__ import annotations

# The six languages of the first pilot, in the order the page lists them.
LANGUAGES = ("en", "ar", "id", "ur", "tr", "fr")

# For the incident description, which staff read in English or Arabic.
LANGUAGE_NAMES = {"en": "English", "ar": "Arabic", "id": "Indonesian", "ur": "Urdu", "tr": "Turkish",
                  "fr": "French"}

# The calls for help: each one is an incident of this kind and priority.
# All three are urgent: a pilgrim who presses one may not be able to say more.
HELP: dict[str, tuple[str, str]] = {
    "sos": ("urgent", "Pressed SOS on Rafeeq."),
    "lost": ("urgent", "Pressed “I am lost” on Rafeeq."),
    "heat": ("urgent", "Said on Rafeeq that they feel unwell in the heat."),
}

# Who the history names for a step the pilgrim took on their page.
ACTOR = "Pilgrim, on Rafeeq"
FINE_NOTE = "The pilgrim says they are fine now."
PRESSED_AGAIN = "Pressed again."

# New calls one card may make in an hour; pressing the same call again only adds a note.
CALLS_PER_HOUR = 6
# A card keeps working this many days after its group's departure date.
DAYS_AFTER_DEPARTURE = 7


def description(kind: str, language: str) -> str:
    _, text = HELP[kind]
    return f"{text} Speaks {LANGUAGE_NAMES[language]}."
