import askPy from "../../../backend/api/duyuf/rafeeq/ask.py?raw";
import { RAFEEQ_LANGUAGES, type RafeeqLang } from "./help";
import type { RafeeqPage } from "./source";
import { ASK_ACTIONS } from "./source";

/**
 * Ask Rafeeq's rules, read from the server's own file
 * (backend/api/duyuf/rafeeq/ask.py, SYSTEM), so the demo that asks Claude
 * through the Claude viewer answers by exactly the rules the real app does.
 */
export const RULES = (() => {
  const start = askPy.indexOf('SYSTEM = """');
  const body = askPy.slice(start + 'SYSTEM = """'.length, askPy.indexOf('"""', start + 12));
  return body.replace(/\\\n/g, "");
})();

const LANGUAGE_NAMES: Record<RafeeqLang, string> = {
  en: "English",
  ar: "Arabic",
  id: "Indonesian",
  ur: "Urdu",
  tr: "Turkish",
  fr: "French",
};

/** What Claude may know about the pilgrim: their own page, in words (as routers/rafeeq.py `situation`). */
export function situation(page: RafeeqPage, now = new Date()) {
  const h = page.health;
  return {
    saudi_time: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Riyadh",
    }).format(now),
    first_name: page.full_name.split(/\s+/)[0],
    group: page.group_name,
    group_leader: page.leader_name,
    leader_phone_on_page: !!page.leader_phone,
    meeting_point: page.meeting?.name ?? null,
    where_most_of_the_group_is_known: !!page.group_now,
    shares_location: page.consent.location,
    health: h ? { overall: h.level, heart: h.heart.state, temperature: h.temperature.state, heat: h.heat, water: h.hydration } : null,
    open_calls_for_help: page.calls.filter((c) => c.status !== "resolved").map((c) => c.kind),
    medical_countdown_running: !!page.alert,
  };
}

/** The whole prompt for one question, as one memoryless call: the rules, the situation, the question. */
export function prompt(question: string, language: RafeeqLang, page: RafeeqPage, history: { question: string; answer: string }[]) {
  const lang = RAFEEQ_LANGUAGES.includes(language) ? LANGUAGE_NAMES[language] : "English";
  const earlier = history
    .slice(-3)
    .map((t) => `Earlier the pilgrim asked: ${t.question}\nRafeeq answered: ${t.answer}`)
    .join("\n\n");
  return (
    `${RULES}\n\nReply with only a JSON object: {"answer": string, "action": one of ${ASK_ACTIONS.map((a) => `"${a}"`).join(", ")}}.\n\n` +
    (earlier ? `${earlier}\n\n` : "") +
    `Answer in ${lang}.\nThe pilgrim's situation now: ${JSON.stringify(situation(page))}\n\nThe pilgrim asks: ${question}`
  );
}
