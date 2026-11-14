import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./design/global.css";

const el = document.getElementById("root")!;
const root = createRoot(el);
const show = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

/*
 * Two apps in one build. /r is Rafeeq, the pilgrim's page: loaded on its own so
 * a phone on a weak signal downloads none of the staff screens. Everything
 * else is the staff app. The demo build lives at one address it does not own,
 * so there a card after the # (#rfq_…), or data-app="rafeeq" on the page,
 * opens Rafeeq, and a card link pressed in the staff app switches to it.
 */
const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1);
const isRafeeq = () => /^\/r\/?$/.test(path) || location.hash.startsWith("#rfq_") || el.dataset.app === "rafeeq";

let showing: "rafeeq" | "staff" | null = null;
function open() {
  const want = isRafeeq() ? "rafeeq" : "staff";
  if (want === showing) return;
  showing = want;
  if (want === "rafeeq") void import("./rafeeq/RafeeqApp").then(({ RafeeqApp }) => show(<RafeeqApp />));
  else void import("./app/App").then(({ App }) => show(<App />));
}
open();
if (import.meta.env.VITE_ROUTER === "hash") window.addEventListener("hashchange", open);
