import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

export const listMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        event_id: z.string().uuid().optional().nullable(),
        status: z.enum(["pending", "mutual"]).optional().nullable(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin.from("matches").select("*").order("matched_at", { ascending: false });
    if (data.event_id) q = q.eq("event_id", data.event_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: matches, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    const empIds = Array.from(new Set((matches ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
    const spIds = Array.from(new Set((matches ?? []).map((m: any) => m.sponsor_user_id).filter(Boolean)));
    const allIds = Array.from(new Set([...empIds, ...spIds]));
    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name, logo_url").in("user_id", empIds.length ? empIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name, logo_url, sponsorship_level").in("user_id", spIds.length ? spIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("profiles").select("id, full_name, account_role").in("id", allIds.length ? allIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const eMap = new Map((emps ?? []).map((e: any) => [e.user_id, e]));
    const sMap = new Map((sps ?? []).map((s: any) => [s.user_id, s]));
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return {
      matches: (matches ?? []).map((m: any) => ({
        ...m,
        empresa: eMap.get(m.empresa_user_id) ?? null,
        sponsor: sMap.get(m.sponsor_user_id) ?? null,
        empresa_responsable: pMap.get(m.empresa_user_id) ?? null,
        sponsor_responsable: pMap.get(m.sponsor_user_id) ?? null,
      })),
    };
  });

export const breakMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    // Remove dependent meetings, then likes that produced the match, then the match
    const { data: m } = await supabaseAdmin.from("matches").select("*").eq("id", data.id).maybeSingle();
    if (m) {
      await supabaseAdmin.from("meetings_1to1").delete().eq("match_id", data.id);
      await supabaseAdmin
        .from("likes")
        .delete()
        .or(
          `and(from_user_id.eq.${m.empresa_user_id},to_user_id.eq.${m.sponsor_user_id}),and(from_user_id.eq.${m.sponsor_user_id},to_user_id.eq.${m.empresa_user_id})`,
        );
    }
    const { error } = await supabaseAdmin.from("matches").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
