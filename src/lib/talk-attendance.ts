export type TalkPerson = { name: string; empresa: string };
export type Talk = { id: string; date: string; start: string; end: string; people: TalkPerson[] };
export type TalkExclusion = { talk_id: string; person_name: string; company_name: string };

export function applyTalkExclusions(talks: Talk[], exclusions: TalkExclusion[]): Talk[] {
  const removed = new Set(exclusions.map((e) => JSON.stringify([e.talk_id, e.person_name, e.company_name])));
  return talks.map((t) => ({ ...t, people: t.people.filter((p) => !removed.has(JSON.stringify([t.id, p.name, p.empresa]))) }));
}

export function personAttendsTalk(talk: Talk, name: string, company?: string): boolean {
  const norm = (s: string) => s.trim().toLocaleLowerCase("es");
  return !!name.trim() && talk.people.some((p) => norm(p.name) === norm(name) && (!company || norm(p.empresa) === norm(company)));
}

export function overlapsTalk(iso: string, duration: number, talk: Talk): boolean {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const local = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00Z`;
  const start = Date.parse(local);
  return start < Date.parse(`${talk.date}T${talk.end}:00Z`) && start + duration * 60000 > Date.parse(`${talk.date}T${talk.start}:00Z`);
}