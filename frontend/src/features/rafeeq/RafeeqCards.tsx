import qrcode from "qrcode-generator";
import { useMemo, useState, type MouseEvent } from "react";
import { useGroupRafeeqCards, usePilgrim, useRafeeqCard, useRafeeqCardStep } from "../../api/queries";
import { useCan } from "../../app/SessionContext";
import { u } from "../../design/ui";
import type { IssuedCard } from "../../domain/types";
import { fmtDate, fmtDateTime, languageName, t } from "../../i18n";
import { isRafeeqLang, isRtl, RAFEEQ_LANGUAGES, type RafeeqLang } from "../../rafeeq/help";
import { say } from "../../rafeeq/words";
import c from "./cards.module.css";

/** The page a card opens. The secret goes after the #, which a browser never sends to a server.
 * In the demo build the same page switches to Rafeeq when the # holds a card. */
export function cardLink(token: string): string {
  if (import.meta.env.VITE_ROUTER === "hash") return `${location.href.split("#")[0]}#${token}`;
  return `${location.origin}${import.meta.env.BASE_URL}r#${token}`;
}

/** A QR code as plain SVG, black on a white quiet zone, so it scans from paper or a screen in either theme. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) d += `M${col},${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <svg className={c.qr} viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** One printed card: the code, whose it is, and what to do with it in the pilgrim's language. */
function Card({ card }: { card: IssuedCard }) {
  const lang = card.language;
  return (
    <article className={c.card}>
      <QrCode text={cardLink(card.token)} label={t("Rafeeq card for {name}", { name: card.full_name })} />
      <div className={c.cardText}>
        <p className={c.brand}>Rafeeq · رفيق</p>
        <p className={c.name}>{card.full_name}</p>
        {card.full_name_ar && (
          <p className={c.nameAr} dir="rtl" lang="ar">
            {card.full_name_ar}
          </p>
        )}
        <p className={c.group}>
          <span className={u.mono}>{card.group_code}</span> · {card.group_name}
        </p>
        <p className={c.scan} lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"}>
          <b>{say("Scan this code for help", lang)}</b>
          <br />
          {say("Keep this card with you.", lang)}
        </p>
        {lang !== "en" && <p className={c.scanEn}>{say("Scan this code for help", "en")}</p>}
      </div>
    </article>
  );
}

/** Cards just made, to print now: their links are never shown again. */
export function CardSheet({ cards }: { cards: IssuedCard[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const one = cards.length === 1 ? cards[0] : null;
  const copy = (token: string) =>
    void navigator.clipboard?.writeText(cardLink(token)).then(
      () => setCopied(token),
      () => setCopied(null),
    );
  return (
    <div className={c.wrap}>
      <p className={`${u.hint} ${c.noPrint}`}>{t("Print or send this now. The link is shown only once.")}</p>
      <div className={`${c.noPrint} ${c.actions}`}>
        <button type="button" className={u.button} onClick={() => window.print()}>
          {t("Print")}
        </button>
        {one && (
          <>
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => copy(one.token)}>
              {copied === one.token ? t("Copied") : t("Copy link")}
            </button>
            <a
              className={`${u.button} ${u.quiet}`}
              href={cardLink(one.token)}
              {...(import.meta.env.VITE_ROUTER === "hash"
                ? {
                    /* the demo: the staff app's own routing would take the # first, so load the page afresh as Rafeeq */
                    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      location.assign(cardLink(one.token));
                      location.reload();
                    },
                  }
                : { target: "_blank", rel: "noreferrer" })}
            >
              {t("Open page")}
            </a>
          </>
        )}
      </div>
      <div className={c.sheet}>
        {cards.map((x) => (
          <Card key={x.token} card={x} />
        ))}
      </div>
    </div>
  );
}

/** In the pilgrim panel: their card, and making, replacing or stopping it. */
export function PilgrimRafeeq({ pilgrimId }: { pilgrimId: string }) {
  const q = useRafeeqCard(pilgrimId);
  const pilgrim = usePilgrim(pilgrimId);
  const step = useRafeeqCardStep(pilgrimId);
  const canIssue = useCan("rafeeq:issue");
  const [asking, setAsking] = useState<"make" | "stop" | null>(null);
  const spoken = pilgrim.data?.language;
  const [lang, setLang] = useState<RafeeqLang | null>(null);
  const chosen: RafeeqLang = lang ?? (isRafeeqLang(spoken) ? spoken : "en");
  const made = step.data ?? null;
  const left = pilgrim.data?.status === "departed";

  if (q.isPending) return <p className={u.muted}>{t("Loading…")}</p>;
  if (q.isError) return <p className={u.error}>{q.error.message}</p>;
  const card = q.data;
  return (
    <div className={c.panel}>
      {card ? (
        <p style={{ margin: 0 }}>
          {t("Card in use since {date}, in {lang}.", { date: fmtDate(card.issued_at), lang: languageName(card.language) })}{" "}
          <span className={u.muted}>
            {card.last_used_at ? t("Last opened {when}.", { when: fmtDateTime(card.last_used_at) }) : t("Not opened yet.")}
          </span>
        </p>
      ) : (
        <p className={u.muted} style={{ margin: 0 }}>
          {left ? t("A pilgrim who has left cannot get a card.") : t("No card yet.")}
        </p>
      )}
      {canIssue && !left && asking === null && (
        <div className={c.actions}>
          <button type="button" className={card ? `${u.button} ${u.quiet}` : u.button} onClick={() => setAsking("make")}>
            {card ? t("New card") : t("Make a card")}
          </button>
          {card && (
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setAsking("stop")}>
              {t("Stop card")}
            </button>
          )}
        </div>
      )}
      {asking === "make" && (
        <div className={c.ask}>
          <label>
            {t("Card language")}{" "}
            <select value={chosen} onChange={(e) => setLang(e.target.value as RafeeqLang)}>
              {RAFEEQ_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
          </label>
          {card && <p className={u.hint}>{t("The old card will stop working.")}</p>}
          <div className={c.actions}>
            <button
              type="button"
              className={u.button}
              disabled={step.isPending}
              onClick={() => step.mutate({ action: "make", language: chosen }, { onSuccess: () => setAsking(null) })}
            >
              {card ? t("Make new card") : t("Make a card")}
            </button>
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setAsking(null)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
      {asking === "stop" && (
        <div className={c.ask}>
          <p style={{ margin: 0 }}>{t("Stop this card? It stops working at once.")}</p>
          <div className={c.actions}>
            <button
              type="button"
              className={u.button}
              disabled={step.isPending}
              onClick={() => step.mutate({ action: "stop" }, { onSuccess: () => setAsking(null) })}
            >
              {t("Stop it")}
            </button>
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={() => setAsking(null)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
      {step.isError && <p className={u.error}>{step.error.message}</p>}
      {made && <CardSheet cards={[made]} />}
    </div>
  );
}

/** On a group's page: cards for everyone still on the journey, as one sheet to print. */
export function GroupRafeeq({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const make = useGroupRafeeqCards(groupId);
  const [replace, setReplace] = useState(false);
  const done = make.data;
  return (
    <section className={u.card} style={{ marginBottom: 16 }}>
      <h2>{t("Rafeeq cards")}</h2>
      {!done ? (
        <>
          <p className={u.hint}>{t("Cards for everyone in this group who has none. Cards already handed out keep working.")}</p>
          <label className={c.check}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />{" "}
            {t("Also replace cards already handed out")}
          </label>
          <div className={c.actions}>
            <button type="button" className={u.button} disabled={make.isPending} onClick={() => make.mutate(replace)}>
              {t("Make cards")}
            </button>
            <button type="button" className={`${u.button} ${u.quiet}`} onClick={onClose}>
              {t("Cancel")}
            </button>
          </div>
          {make.isError && <p className={u.error}>{make.error.message}</p>}
        </>
      ) : (
        <>
          <p style={{ margin: "4px 0 8px" }}>
            {done.cards.length === 0
              ? done.kept > 0
                ? t("Everyone already has a card.")
                : t("No one in this group is still on the journey.")
              : t("{n} cards made.", { n: done.cards.length })}{" "}
            {done.kept > 0 && done.cards.length > 0 && <span className={u.muted}>{t("{n} already had a card.", { n: done.kept })}</span>}
          </p>
          {done.cards.length > 0 && <CardSheet cards={done.cards} />}
          <button type="button" className={`${u.button} ${u.quiet} ${c.noPrint}`} onClick={onClose}>
            {t("Close")}
          </button>
        </>
      )}
    </section>
  );
}
