type Meeting = { scheduled_time: string | null; status: string | null };

export function countScheduledMeetings(meetings: Meeting[]): number {
  return meetings.filter((m) => m.scheduled_time !== null && m.status !== "cancelled").length;
}

export function uniquePartnerAccounts(ids: (string | null)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}