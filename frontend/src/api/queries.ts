import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../app/SessionContext";
import type { Status } from "../domain/journey";
import type {
  Assignment,
  FlightChange,
  GroupChange,
  IncidentFilter,
  NewFlight,
  NewGroup,
  NewIncident,
  NewPilgrim,
  NewShift,
  PilgrimChange,
  PilgrimFilter,
  WhatIf,
} from "../domain/types";

export function useOverview() {
  const { source } = useSession();
  return useQuery({ queryKey: ["overview"], queryFn: () => source.overview() });
}

export function useGroups() {
  const { source } = useSession();
  return useQuery({ queryKey: ["groups"], queryFn: () => source.groups() });
}

export function useGroup(id: string | undefined) {
  const { source } = useSession();
  return useQuery({ queryKey: ["group", id], queryFn: () => source.group(id!), enabled: !!id });
}

export function usePilgrims(filter: PilgrimFilter) {
  const { source } = useSession();
  return useQuery({ queryKey: ["pilgrims", filter], queryFn: () => source.pilgrims(filter) });
}

export function usePilgrim(id: string | undefined) {
  const { source } = useSession();
  return useQuery({ queryKey: ["pilgrim", id], queryFn: () => source.pilgrim(id!), enabled: !!id });
}

/** Every screen that counts pilgrims, by stage or by flight. */
const COUNTED = [
  "pilgrims",
  "pilgrim",
  "groups",
  "group",
  "overview",
  "arrivals",
  "flight",
  "what-if",
  "shifts",
  "incidents",
  "incident",
];

function useRefreshAll() {
  const qc = useQueryClient();
  return () => COUNTED.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
}

/** One step along the journey. Every count on every screen depends on it, so all of them refresh. */
export function useMovePilgrim() {
  const { source } = useSession();
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (v: { id: string; to: Status; note?: string }) => source.movePilgrim(v.id, v.to, v.note),
    onSuccess: (p) => {
      qc.setQueryData(["pilgrim", p.id], p);
      refresh();
    },
  });
}

export function useArrivals(hours: number) {
  const { source } = useSession();
  /* "due" depends on the clock: look again every minute */
  return useQuery({ queryKey: ["arrivals", hours], queryFn: () => source.arrivals(hours), refetchInterval: 60_000 });
}

export function useFlight(id: string | undefined) {
  const { source } = useSession();
  return useQuery({ queryKey: ["flight", id], queryFn: () => source.flight(id!), enabled: !!id });
}

export function useCreateFlight() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (f: NewFlight) => source.createFlight(f), onSuccess: refresh });
}

export function useUpdateFlight(id: string) {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (c: FlightChange) => source.updateFlight(id, c), onSuccess: refresh });
}

export function useAssignToFlight(id: string) {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (a: Assignment) => source.assignToFlight(id, a), onSuccess: refresh });
}

export function useLandFlight(id: string) {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (note?: string) => source.landFlight(id, note), onSuccess: refresh });
}

/** The board under a what-if: null asks for nothing. Read-only, so it is a query, not a change. */
export function useWhatIf(w: WhatIf | null) {
  const { source } = useSession();
  return useQuery({ queryKey: ["what-if", w], queryFn: () => source.whatIf(w!), enabled: !!w });
}

export function useShifts() {
  const { source } = useSession();
  return useQuery({ queryKey: ["shifts"], queryFn: () => source.shifts() });
}

export function useAddShift() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (s: NewShift) => source.addShift(s), onSuccess: refresh });
}

export function useRemoveShift() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (id: string) => source.removeShift(id), onSuccess: refresh });
}

export function useCreateGroup() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (g: NewGroup) => source.createGroup(g), onSuccess: refresh });
}

export function useUpdateGroup(id: string) {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (c: GroupChange) => source.updateGroup(id, c), onSuccess: refresh });
}

export function useCreatePilgrim() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (p: NewPilgrim) => source.createPilgrim(p), onSuccess: refresh });
}

export function useUpdatePilgrim(id: string) {
  const { source } = useSession();
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (c: PilgrimChange) => source.updatePilgrim(id, c),
    onSuccess: (p) => {
      qc.setQueryData(["pilgrim", p.id], p);
      refresh();
    },
  });
}

/** Check (dryRun) or save a spreadsheet of pilgrims into a group. Only a save changes the screens. */
export function useImportPilgrims(groupId: string) {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (v: { rows: Record<string, string>[]; dryRun: boolean }) =>
      source.importPilgrims(groupId, v.rows, v.dryRun),
    onSuccess: (r) => {
      if (r.saved) refresh();
    },
  });
}

/** The incident queue: looked at again every 20 seconds, it is live work. */
export function useIncidents(f: IncidentFilter) {
  const { source } = useSession();
  return useQuery({ queryKey: ["incidents", f], queryFn: () => source.incidents(f), refetchInterval: 20_000 });
}

export function useIncident(id: string | undefined) {
  const { source } = useSession();
  return useQuery({ queryKey: ["incident", id], queryFn: () => source.incident(id!), enabled: !!id, refetchInterval: 20_000 });
}

export function useRaiseIncident() {
  const { source } = useSession();
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (i: NewIncident) => source.raiseIncident(i), onSuccess: refresh });
}

/** assign, resolve, reopen or note: one step on one incident. */
export function useIncidentStep(id: string) {
  const { source } = useSession();
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (v: { action: "assign" | "resolve" | "reopen" | "note"; text: string; team?: string }) => {
      switch (v.action) {
        case "assign":
          return source.assignIncident(id, v.team ?? "", v.text || undefined);
        case "resolve":
          return source.resolveIncident(id, v.text);
        case "reopen":
          return source.reopenIncident(id, v.text);
        default:
          return source.noteIncident(id, v.text);
      }
    },
    onSuccess: (i) => {
      qc.setQueryData(["incident", i.id], i);
      refresh();
    },
  });
}
