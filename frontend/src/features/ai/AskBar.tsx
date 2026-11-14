import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAsk, useGroups } from "../../api/queries";
import { useSession } from "../../app/SessionContext";
import { t } from "../../i18n";
import ai from "./ai.module.css";
import { Spark } from "./BriefCard";

interface Hit {
  key: string;
  kind: string;
  label: string;
  sub?: string;
  go: () => void;
}

const SCREENS: { label: string; to: string }[] = [
  { label: "Overview", to: "/" },
  { label: "Arrivals", to: "/arrivals" },
  { label: "Resources", to: "/arrivals/resources" },
  { label: "Groups", to: "/groups" },
  { label: "Pilgrims", to: "/pilgrims" },
  { label: "Incidents", to: "/incidents" },
  { label: "Health", to: "/health" },
  { label: "Analyst", to: "/analyst" },
];

/** A question, not a name: it reads like one. */
const isQuestion = (s: string) => /[?؟]$/.test(s.trim()) || s.trim().split(/\s+/).length >= 4;

/**
 * Ask anywhere: one bar on every screen. Type a name, a group, a flight or a
 * screen and go straight there; type a question and the analyst answers it
 * here, from the operator's totals. "/" or Ctrl+K puts the cursor in it.
 */
export function AskBar() {
  const { source } = useSession();
  const go = useNavigate();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const ask = useAsk();
  const groups = useGroups();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        box.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const people = useQuery({
    queryKey: ["askbar-pilgrims", debounced],
    queryFn: () => source.pilgrims({ q: debounced, limit: 5 }),
    enabled: open && debounced.length >= 2 && !isQuestion(debounced),
  });
  const flights = useQuery({
    queryKey: ["askbar-flights"],
    queryFn: () => source.arrivals(72),
    enabled: open,
    staleTime: 60_000,
  });

  const hits = useMemo<Hit[]>(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const done = (to: string) => () => {
      setOpen(false);
      setText("");
      go(to);
    };
    const out: Hit[] = [];
    for (const s of SCREENS) if (t(s.label).toLowerCase().includes(q) || s.label.toLowerCase().includes(q)) out.push({ key: `s${s.to}`, kind: t("Screen"), label: t(s.label), go: done(s.to) });
    for (const g of groups.data ?? [])
      if (g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q))
        out.push({ key: `g${g.id}`, kind: t("Group"), label: g.name, sub: g.code, go: done(`/groups/${g.id}`) });
    for (const f of flights.data?.flights ?? [])
      if (f.number.toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, "")))
        out.push({ key: `f${f.id}`, kind: t("Flight"), label: f.number, sub: `${f.origin_airport} → ${f.arrival_airport}${f.gate ? ` · ${f.gate}` : ""}`, go: done(`/arrivals/${f.id}`) });
    for (const p of people.data?.items ?? [])
      out.push({ key: `p${p.id}`, kind: t("Pilgrim"), label: p.full_name, sub: p.group_code, go: done(`/pilgrims?open=${p.id}`) });
    return out.slice(0, 8);
  }, [text, groups.data, flights.data, people.data, go]);

  const askIt = () => {
    const q = text.trim();
    if (!q) return;
    ask.mutate({ question: q, history: [] });
  };
  const rows = [...hits, ...(text.trim() ? [{ key: "ask", kind: t("Ask"), label: t("Ask the analyst: {q}", { q: text.trim() }), go: askIt }] : [])];
  const pick = isQuestion(text) ? rows.length - 1 : active;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[Math.min(pick, rows.length - 1)]?.go();
    } else if (e.key === "Escape") {
      setOpen(false);
      box.current?.blur();
    }
  };

  return (
    <div className={ai.askBar} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <Spark />
      <input
        ref={box}
        value={text}
        dir="auto"
        placeholder={t("Ask anything, or find a name…")}
        aria-label={t("Ask anything, or find a name")}
        role="combobox"
        aria-expanded={open && (rows.length > 0 || !!ask.data || ask.isPending)}
        aria-controls="duyuf-askbar"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          ask.reset();
        }}
        onKeyDown={onKey}
      />
      <kbd className={ai.kbd}>/</kbd>
      {open && (rows.length > 0 || ask.isPending || ask.data || ask.isError) && (
        <div className={ai.dropdown} id="duyuf-askbar" role="listbox">
          {ask.isPending || ask.data || ask.isError ? (
            <div className={ai.answer}>
              <span className={ai.badge}>
                <Spark /> {t("Analyst")}
              </span>
              {ask.isPending ? (
                <p className={ai.foot}>{t("Thinking…")}</p>
              ) : ask.isError ? (
                <p>{(ask.error as Error).message}</p>
              ) : (
                <p dir="auto">{ask.data?.answer ?? t("No answer came back.")}</p>
              )}
              <button
                type="button"
                className={ai.link}
                onClick={() => {
                  setOpen(false);
                  go("/analyst");
                }}
              >
                {t("Open the Analyst")}
              </button>
            </div>
          ) : (
            rows.map((h, i) => (
              <button key={h.key} type="button" role="option" aria-selected={i === pick} className={ai.hit} onMouseDown={(e) => e.preventDefault()} onClick={h.go}>
                <span className={ai.hitKind}>{h.kind}</span>
                <span className={ai.hitLabel} dir="auto">
                  {h.label}
                </span>
                {h.sub && <span className={ai.hitSub}>{h.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
