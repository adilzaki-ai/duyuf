import { createContext, useContext } from "react";
import type { StartedSource } from "../api/createDataSource";
import type { Scope } from "../domain/types";

const SessionContext = createContext<StartedSource | null>(null);

export const SessionProvider = SessionContext.Provider;

export function useSession(): StartedSource {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** Whether the person may do something. Screens hide what the platform would refuse. */
export function useCan(scope: Scope): boolean {
  return useSession().me.scopes.includes(scope);
}
