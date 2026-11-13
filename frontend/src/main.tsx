import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./design/global.css";

const root = createRoot(document.getElementById("root")!);
const show = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

/*
 * Two apps in one build. /r is Rafeeq, the pilgrim's page: loaded on its own so
 * a phone on a weak signal downloads none of the staff screens. Everything
 * else is the staff app.
 */
const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1);
if (/^\/r\/?$/.test(path)) void import("./rafeeq/RafeeqApp").then(({ RafeeqApp }) => show(<RafeeqApp />));
else void import("./app/App").then(({ App }) => show(<App />));
