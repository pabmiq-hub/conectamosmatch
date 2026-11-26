export type MeetingSide = "empresa" | "sponsor";

export type MeetingAvailabilityRow = {
  scheduled_time: string | null;
  empresa_user_id: string | null;
  sponsor_user_id: string | null;
  room: string | null;
};

export type ResponsibleAvailability = { profile_id: string };
export type PartyAvailability = {
  user_id: string | null;
  responsables: ResponsibleAvailability[];
};

export function meetingsAt<T extends MeetingAvailabilityRow>(rows: T[], iso: string): T[] {
  const target = new Date(iso).toISOString();
  return rows.filter((row) => row.scheduled_time && new Date(row.scheduled_time).toISOString() === target);
}

export function busyUserIds(rows: MeetingAvailabilityRow[], iso: string, side: MeetingSide): Set<string> {
  const key = side === "empresa" ? "empresa_user_id" : "sponsor_user_id";
  return new Set(meetingsAt(rows, iso).map((row) => row[key]).filter((id): id is string => !!id));
}

export function availableResponsibleIds(
  rows: MeetingAvailabilityRow[],
  iso: string,
  side: MeetingSide,
  profileIds: string[],
): string[] {
  const busy = busyUserIds(rows, iso, side);
  return profileIds.filter((id) => !busy.has(id));
}

/** An account remains selectable while at least one active responsable is free. */
export function accountHasFreeResponsible(party: PartyAvailability, busyIds: ReadonlySet<string>): boolean {
  const ids = party.responsables.length
    ? party.responsables.map((person) => person.profile_id)
    : party.user_id
      ? [party.user_id]
      : [];
  return ids.some((id) => !busyIds.has(id));
}

export type MeetingConflict = "empresa_person" | "sponsor_person" | "room" | null;

/** Parallel meetings are valid for different people and different physical tables. */
export function findMeetingConflict(
  rows: MeetingAvailabilityRow[],
  proposed: { scheduled_time: string; empresa_user_id: string; sponsor_user_id: string; room?: string | null },
): MeetingConflict {
  const proposedRoom = proposed.room?.trim().toLowerCase();
  for (const row of meetingsAt(rows, proposed.scheduled_time)) {
    if (row.empresa_user_id === proposed.empresa_user_id) return "empresa_person";
    if (row.sponsor_user_id === proposed.sponsor_user_id) return "sponsor_person";
    if (proposedRoom && row.room?.trim().toLowerCase() === proposedRoom) return "room";
  }
  return null;
}

export function firstFreeRoom(rows: MeetingAvailabilityRow[], iso: string, preferredRooms: string[]): string | null {
  const used = new Set(meetingsAt(rows, iso).map((row) => row.room?.trim().toLowerCase()).filter(Boolean));
  return preferredRooms.find((room) => !used.has(room.trim().toLowerCase())) ?? null;
}
