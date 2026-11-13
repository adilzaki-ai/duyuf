import { createContext, useContext } from "react";
import type { StartedSource } from "../api/createDataSource";
import type { Me, Scope } from "../domain/types";

/** Inside the app someone is always signed in: `me` is never null here. */
export type Session = StartedSource & {
  me: Me;
  /** after a sign out, or when the platform says the session has ended */
  signedOut: () => void;
  /** after changing one's own password */
  updateMe: (me: Me) => void;
};

const SessionContext = createContext<Session | null>(null);

export const SessionProvider = SessionContext.Provider;

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}

/** Whether the person may do something. Screens hide what the platform would refuse. */
export function useCan(scope: Scope): boolean {
  return useSession().me.scopes.includes(scope);
}
