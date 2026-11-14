import { useEffect, useState } from "react";
import type { RafeeqLang } from "./help";

/**
 * Speech to text for Ask Rafeeq. In the Claude viewer (the client demo) the
 * viewer's own dictation; in the real app, the phone browser's speech
 * recognition (Chrome on Android, Safari on iPhone). Where neither exists the
 * page keeps a typed question only.
 */
export interface Ear {
  /** Call straight from the press: the browser asks for the microphone only then. */
  start(lang: RafeeqLang, on: { partial(text: string): void; final(text: string): void; end(problem?: string): void }): void;
  stop(): void;
}

const LOCALE: Record<RafeeqLang, string> = { en: "en-US", ar: "ar-SA", id: "id-ID", ur: "ur-PK", tr: "tr-TR", fr: "fr-FR" };

type Unsub = () => void;
interface Dictation {
  start(o?: { language?: string }): Promise<void>;
  stop(): Promise<void>;
  onPartial(h: (e: { text: string }) => void): Unsub;
  onFinal(h: (e: { text: string }) => void): Unsub;
  onState(h: (e: { state: string; reason?: string }) => void): Unsub;
}

function fromDictation(d: Dictation): Ear {
  let subs: Unsub[] = [];
  const clear = () => {
    subs.forEach((u) => u());
    subs = [];
  };
  return {
    start(lang, on) {
      clear();
      subs = [
        d.onPartial(({ text }) => on.partial(text)),
        d.onFinal(({ text }) => on.final(text)),
        d.onState(({ state, reason }) => {
          if (state !== "idle") return;
          clear();
          on.end(reason && !["stopped", "viewer_stopped"].includes(reason) ? reason : undefined);
        }),
      ];
      /* synchronously, inside the press */
      d.start({ language: lang }).catch((e: { code?: string }) => {
        clear();
        on.end(e?.code ?? "upstream_error");
      });
    },
    stop() {
      void d.stop();
    },
  };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function fromBrowser(SR: new () => Recognition): Ear {
  let rec: Recognition | null = null;
  return {
    start(lang, on) {
      rec?.stop();
      const r = new SR();
      rec = r;
      r.lang = LOCALE[lang];
      r.interimResults = true;
      r.continuous = false;
      let problem: string | undefined;
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) {
            on.partial("");
            on.final(res[0].transcript);
          } else on.partial(res[0].transcript);
        }
      };
      r.onerror = (e) => {
        problem = e.error === "no-speech" || e.error === "aborted" ? undefined : e.error;
      };
      r.onend = () => {
        rec = null;
        on.end(problem);
      };
      try {
        r.start();
      } catch {
        on.end("upstream_error");
      }
    },
    stop() {
      rec?.stop();
    },
  };
}

export function useEar(): Ear | null {
  const [ear, setEar] = useState<Ear | null>(null);
  useEffect(() => {
    let live = true;
    const g = globalThis as {
      claude?: { use(name: "dictation"): Promise<Dictation | null> };
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const browser = g.SpeechRecognition ?? g.webkitSpeechRecognition;
    if (g.claude?.use) {
      g.claude
        .use("dictation")
        .then((d) => live && setEar(d ? fromDictation(d) : null), () => {});
    } else if (browser) {
      setEar(fromBrowser(browser));
    }
    return () => {
      live = false;
    };
  }, []);
  return ear;
}
