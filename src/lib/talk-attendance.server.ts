import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import base from "@/data/talks-conectamos27h.json";
import { applyTalkExclusions, personAttendsTalk, type Talk } from "./talk-attendance";
import { fetchAll } from "./event-scope.server";

export async function readEventTalks(client: SupabaseClient<Database>, eventId: string): Promise<Talk[]> {
  if (eventId !== base.eventId) return [];
  const exclusions = await fetchAll((from, to) => client.from("event_talk_exclusions")
    .select("talk_id, person_name, company_name").eq("event_id", eventId)
    .order("talk_id").order("person_name").order("company_name").range(from, to));
  return applyTalkExclusions(base.talks, exclusions);
}

export async function profileTalks(client: SupabaseClient<Database>, talks: Talk[], userId: string): Promise<Talk[]> {
  if (!talks.length) return [];
  const { data: person, error } = await client.from("profiles").select("full_name, account_id, role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!person?.full_name) return [];
  const table = person.role === "sponsor" ? "sponsor_profiles" : "empresa_profiles";
  let query = client.from(table).select("company_name");
  query = person.account_id ? query.eq("id", person.account_id) : query.eq("user_id", userId);
  const { data: account, error: accountError } = await query.maybeSingle();
  if (accountError) throw new Error(accountError.message);
  return talks.filter((t) => personAttendsTalk(t, person.full_name ?? "", account?.company_name));
}
/** Talks a profile attends, with the exact Talk entry so it can be excluded (rescued). */
export async function profileTalkEntries(client: SupabaseClient<Database>, talks: Talk[], userId: string) {
  const mine = await profileTalks(client, talks, userId);
  if (!mine.length) return [];
  const { data: person } = await client.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return mine.flatMap((t) => {
    const p = t.people.find((x) => norm(x.name) === norm(person?.full_name ?? ""));
    return p ? [{ talk: t, person: p, user_id: userId }] : [];
  });
}
