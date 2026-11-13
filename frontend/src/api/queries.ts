import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../app/SessionContext";
import type { Status } from "../domain/journey";
import type { Assignment, FlightChange, NewFlight, PilgrimFilter } from "../domain/types";

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
const COUNTED = ["pilgrims", "pilgrim", "groups", "group", "overview", "arrivals", "flight"];

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
