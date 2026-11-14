import promptsPy from "../../../backend/api/duyuf/ai/prompts.py?raw";
import { DataSourceError } from "../api/dataSource";

/**
 * The staff AI helpers in the client demo: the same instructions as the
 * server (backend/api/duyuf/ai/prompts.py, read from that very file), asked
 * of Claude through the Claude viewer's `sample` capability, on the viewer's
 * own account and with their consent. Outside the viewer the sample has no
 * AI, and says so.
 */

/** One of the instructions in prompts.py, as the server sends it. */
export function instruction(name: "BRIEF" | "COPILOT" | "ADVISOR"): string {
  const start = promptsPy.indexOf(`${name} = """`);
  if (start < 0) throw new Error(`no ${name} in prompts.py`);
  const from = start + `${name} = """`.length;
  return promptsPy.slice(from, promptsPy.indexOf('"""', from)).replace(/\\\n/g, "");
}

/** The answer shape, as a JSON example the model fills in (the server enforces a schema instead). */
export const SHAPES = {
  BRIEF:
    '{"headline": string, "points": [{"text": string, "tone": "act"|"watch"|"ok", "screen": "overview"|"arrivals"|"resources"|"incidents"|"health"|"groups"|"pilgrims"}], "first_action": {"text": string, "screen": same choices}}',
  COPILOT:
    '{"summary": string, "priority_ok": boolean, "suggested_priority": "urgent"|"high"|"normal", "team": string, "next_step": string, "message_to_leader": {"language": string, "text": string, "english": string}, "message_to_pilgrim": {"language": string, "text": string, "english": string}}',
  ADVISOR:
    '{"summary": string, "items": [{"gap": number, "explain": string, "fix": string, "extra": null | {"airport": string, "kind": "wheelchair"|"bus"|"interpreter", "language": string|null, "quantity": number}}]}',
} as const;

interface SampleFn {
  json(input: string, options?: { modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<unknown>;
}

async function viewerSample(): Promise<SampleFn | null> {
  const viewer = (globalThis as { claude?: { use(name: "sample"): Promise<SampleFn | null> } }).claude;
  return viewer?.use ? viewer.use("sample").catch(() => null) : null;
}

export async function viewerReady(): Promise<boolean> {
  return !!(await viewerSample());
}

/** Ask Claude through the viewer; a refusal or a failure becomes the error the screens already show. */
export async function askViewer<T>(name: keyof typeof SHAPES, language: "en" | "ar", situation: unknown, request: string): Promise<T> {
  const sample = await viewerSample();
  if (!sample) throw new DataSourceError("The AI helpers need the platform. Sample mode does not send anything out.", { status: 503 });
  const input =
    `${instruction(name)}\n\nReply with only a JSON object of this shape: ${SHAPES[name]}\n\n` +
    `Write in ${language === "ar" ? "Arabic" : "English"}.\n${request}\n\n${JSON.stringify(situation)}`;
  try {
    return (await sample.json(input, { modelTier: "quick", cache: false })) as T;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "refused") throw new DataSourceError("the AI helper declined to answer this one", { status: 422 });
    throw new DataSourceError(`the AI helper is not available here (${code ?? "unknown"})`, { status: code === "rate_limited" ? 429 : 503 });
  }
}
