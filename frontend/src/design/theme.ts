import { useEffect, useState } from "react";

/**
 * Light or the dark operations room. An explicit choice is kept on this
 * computer and stamped on <html data-theme>; with no choice the page follows
 * the computer's own setting (global.css reads prefers-color-scheme).
 */
export type Theme = "light" | "dark";
const KEY = "duyuf.theme";

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

const systemDark = () => globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export function useTheme(): [Theme, () => void] {
  const [chosen, setChosen] = useState<Theme | null>(stored);
  const effective: Theme = chosen ?? (systemDark() ? "dark" : "light");
  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen;
    else delete document.documentElement.dataset.theme;
  }, [chosen]);
  const toggle = () => {
    const next: Theme = effective === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private window: lasts this visit */
    }
    setChosen(next);
  };
  return [effective, toggle];
}
