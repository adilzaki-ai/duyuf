import type { Status } from "./journey";

export type GroupKind = "hajj" | "umrah";
export type Need = "wheelchair" | "medical" | "elderly" | "dietary" | "unaccompanied_minor";
export type Scope =
  | "group:read"
  | "group:write"
  | "pilgrim:read"
  | "pilgrim:write"
  | "pilgrim:status"
  | "pilgrim:identity";

export interface Me {
  tenant: { id: string; slug: string; name: string; name_ar: string | null; is_demo: boolean };
  principal: { id: string | null; name: string; role: string };
  scopes: Scope[];
}

export interface Group {
  id: string;
  code: string;
  name: string;
  kind: GroupKind;
  season: string;
  origin_country: string;
  arrival_date: string | null;
  departure_date: string | null;
  leader_name: string | null;
  leader_phone: string | null;
  pilgrims: number;
  by_status: Partial<Record<Status, number>>;
}

export interface Pilgrim {
  id: string;
  group_id: string;
  group_code: string;
  group_name: string;
  full_name: string;
  full_name_ar: string | null;
  gender: "male" | "female";
  /** null when the caller may not see it (no pilgrim:identity) */
  date_of_birth: string | null;
  nationality: string;
  /** masked to "•••• 1234" without pilgrim:identity */
  passport_no: string;
  phone: string | null;
  status: Status;
  needs: Need[];
  updated_at: string;
  /** the moves the platform will accept from here */
  allowed: Status[];
}

export interface JourneyStep {
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  actor: string;
  at: string;
}

export interface PilgrimDetail extends Pilgrim {
  history: JourneyStep[];
}

export interface MovingGroup {
  id: string;
  code: string;
  name: string;
  kind: GroupKind;
  origin_country: string;
  on_date: string;
  pilgrims: number;
}

export interface Overview {
  today: string;
  window_days: number;
  groups: number;
  pilgrims: number;
  by_status: Record<Status, number>;
  needs: Partial<Record<Need, number>>;
  arriving: MovingGroup[];
  departing: MovingGroup[];
}

export interface PilgrimFilter {
  group_id?: string;
  status?: Status;
  q?: string;
  limit?: number;
  offset?: number;
}
