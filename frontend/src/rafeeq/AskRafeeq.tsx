import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DataSourceError } from "../api/dataSource";
import type { RafeeqLang } from "./help";
import type { AskAction, RafeeqPage, RafeeqSource } from "./source";
import { useEar } from "./voice";
import { say } from "./words";
import r from "./rafeeq.module.css";

/**
 * Ask Rafeeq: the pilgrim asks by voice or types, in their own language, and
 * Claude answers from their own page (rafeeq/ask.py on the server). Each
 * answer is spoken, and may come with one big button: the step Rafeeq
 * suggests. The pilgrim presses it; Rafeeq never calls anyone itself.
 */

interface Turn {
  question: string;
  answer: string | null;
  action: AskAction;
  /** what to show instead of an answer */
  problem?: string;
}

const STARTERS = ["Where is my group?", "I feel dizzy", "Is it too hot to walk now?", "Where is my meeting point?"];

export function AskRafeeq({
  source,
  page,
  lang,
  speak,
  act,
}: {
  source: RafeeqSource;
  page: RafeeqPage;
  lang: RafeeqLang;
  speak: ((text: string) => void) | null;
  /** run the suggested step: sos, find_my_way, drank_water, heat_safety */
  act: (a: AskAction) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [voiceProblem, setVoiceProblem] = useState(false);
  const ear = useEar();
  const said = useRef("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [turns, thinking]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;
    setText("");
    setHeard("");
    setThinking(true);
    const history = turns.filter((t) => t.answer).map((t) => ({ question: t.question, answer: t.answer! }));
    let turn: Turn;
    try {
      const a = await source.ask(q, lang, history);
      turn =
        a.outcome === "answered" && a.answer
          ? { question: q, answer: a.answer, action: a.action }
          : { question: q, answer: null, action: "call_leader", problem: say("Rafeeq cannot answer that. Your group leader can help.", lang) };
    } catch (err) {
      const busy = err instanceof DataSourceError && err.status === 429;
      turn = {
        question: q,
        answer: null,
        action: "sos",
        problem: busy
          ? say("You have asked many questions this hour. If you need help, press SOS or call your group leader.", lang)
          : say("Ask Rafeeq is not available now. If you need help, press SOS or call your group leader.", lang),
      };
    }
    setTurns((ts) => [...ts, turn]);
    setThinking(false);
    if (speak) speak(turn.answer ?? turn.problem ?? "");
  };

  const listen = () => {
    if (!ear) return;
    if (listening) return ear.stop();
    said.current = "";
    setVoiceProblem(false);
    setListening(true);
    ear.start(lang, {
      partial: (t) => setHeard((said.current + " " + t).trim()),
      final: (t) => {
        said.current = (said.current + " " + t).trim();
        setHeard(said.current);
      },
      end: (problem) => {
        setListening(false);
        if (problem) setVoiceProblem(true);
        if (said.current) void send(said.current);
      },
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <section className={r.ask} aria-labelledby="rafeeq-ask-title">
      <h2 id="rafeeq-ask-title">{say("Ask Rafeeq", lang)}</h2>
      <p className={r.quiet}>{say("Ask by voice or type. Rafeeq answers in your language.", lang)}</p>

      <div className={r.chat} aria-live="polite">
        {turns.length === 0 && !thinking && (
          <div className={r.starters}>
            {STARTERS.map((s) => (
              <button key={s} type="button" className={r.starter} onClick={() => void send(say(s, lang))}>
                {say(s, lang)}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={r.turn}>
            <p className={r.bubbleMe} dir="auto">
              {t.question}
            </p>
            <div className={`${r.bubbleRafeeq} ${t.problem ? r.bubbleProblem : ""}`}>
              <p dir="auto">{t.answer ?? t.problem}</p>
              {speak && (
                <button type="button" className={r.bubbleListen} onClick={() => speak(t.answer ?? t.problem ?? "")}>
                  {say("Listen", lang)}
                </button>
              )}
            </div>
            {i === turns.length - 1 && t.action !== "none" && <Suggested action={t.action} lang={lang} page={page} act={act} />}
          </div>
        ))}
        {thinking && (
          <p className={`${r.bubbleRafeeq} ${r.thinking}`} role="status">
            <span>{say("Thinking…", lang)}</span>
            <span className={r.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        )}
        <div ref={end} />
      </div>

      {ear && (
        <div className={r.micWrap}>
          <button
            type="button"
            className={`${r.mic} ${listening ? r.micOn : ""}`}
            aria-pressed={listening}
            aria-label={listening ? say("Listening…", lang) : say("Tap and speak", lang)}
            onClick={listen}
            disabled={thinking}
          >
            <MicIcon />
          </button>
          <p className={r.micLabel}>{listening ? heard || say("Listening…", lang) : say("Tap and speak", lang)}</p>
          {voiceProblem && <p className={r.quiet}>{say("Voice did not work here. Please type your question.", lang)}</p>}
        </div>
      )}

      <form className={r.askForm} onSubmit={submit}>
        <input
          id="rafeeq-question"
          value={text}
          dir="auto"
          maxLength={500}
          placeholder={say("Type your question", lang)}
          aria-label={say("Type your question", lang)}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className={r.askSend} disabled={!text.trim() || thinking}>
          {say("Ask", lang)}
        </button>
      </form>
      <p className={r.footnote}>{say("Rafeeq can be wrong. In danger, press SOS.", lang)}</p>
    </section>
  );
}

/** The one step Rafeeq suggests, as a big button the pilgrim presses. */
function Suggested({ action, lang, page, act }: { action: AskAction; lang: RafeeqLang; page: RafeeqPage; act: (a: AskAction) => void }) {
  let body: ReactNode;
  if (action === "call_leader") {
    if (!page.leader_phone) return null;
    return (
      <a className={`${r.big} ${r.suggestLeader}`} href={`tel:${page.leader_phone.replace(/[^\d+]/g, "")}`}>
        {say("Call your group leader", lang)}
      </a>
    );
  }
  const cls = action === "sos" ? r.sos : action === "find_my_way" ? r.lost : action === "drank_water" ? r.water : r.heat;
  body =
    action === "sos"
      ? say("SOS", lang)
      : action === "find_my_way"
        ? say("Find my way", lang)
        : action === "drank_water"
          ? say("I drank water", lang)
          : say("Heat safety", lang);
  return (
    <button type="button" className={`${r.big} ${cls} ${r.suggest}`} onClick={() => act(action)}>
      {body}
    </button>
  );
}

export const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
    <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
