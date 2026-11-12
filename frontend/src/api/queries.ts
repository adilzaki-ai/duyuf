import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../app/SessionContext";
import type { Status } from "../domain/journey";
import type { PilgrimFilter } from "../domain/types";

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

/** One step along the journey. Every count on every screen depends on it, so all of them refresh. */
export function useMovePilgrim() {
  const { source } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; to: Status; note?: string }) => source.movePilgrim(v.id, v.to, v.note),
    onSuccess: (p) => {
      qc.setQueryData(["pilgrim", p.id], p);
      void qc.invalidateQueries({ queryKey: ["pilgrims"] });
      void qc.invalidateQueries({ queryKey: ["groups"] });
      void qc.invalidateQueries({ queryKey: ["group"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}
