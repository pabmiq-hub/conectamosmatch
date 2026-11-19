import { supabase } from "@/integrations/supabase/client";
import { getMyEventScope, type MyEventScope } from "@/lib/my-event.functions";

let cache: { at: number; uid: string; p: Promise<MyEventScope> } | null = null;

/** Cached (30s, per user) lookup of the participant's current event and its participants. */
export async function fetchMyEventScope(force = false): Promise<MyEventScope> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? "";
  if (!force && cache && cache.uid === uid && Date.now() - cache.at < 30_000) return cache.p;
  const p = getMyEventScope().catch((e) => { cache = null; throw e; });
  cache = { at: Date.now(), uid, p };
  return p;
}
