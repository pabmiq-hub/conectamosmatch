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

    const empUserIds = Array.from(new Set((matches ?? []).map((m: any) => m.empresa_user_id).filter(Boolean)));
    const spUserIds = Array.from(new Set((matches ?? []).map((m: any) => m.sponsor_user_id).filter(Boolean)));
    const allUserIds = Array.from(new Set([...empUserIds, ...spUserIds]));

    // Fetch ALL empresa & sponsor accounts so admin can see zero-match groups too
    const [{ data: allEmps }, { data: allSps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name, logo_url"),
      supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name, logo_url, sponsorship_level"),
      supabaseAdmin.from("profiles").select("id, full_name, account_role").in("id", allUserIds.length ? allUserIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    // Index by both account.id and owner user_id (covers older matches where account_id is null)
    const eById = new Map((allEmps ?? []).map((e: any) => [e.id, e]));
    const eByUser = new Map((allEmps ?? []).map((e: any) => [e.user_id, e]));
    const sById = new Map((allSps ?? []).map((s: any) => [s.id, s]));
    const sByUser = new Map((allSps ?? []).map((s: any) => [s.user_id, s]));
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const resolveEmp = (m: any) => eById.get(m.empresa_account_id) ?? eByUser.get(m.empresa_user_id) ?? null;
    const resolveSp = (m: any) => sById.get(m.sponsor_account_id) ?? sByUser.get(m.sponsor_user_id) ?? null;
    return {
      matches: (matches ?? []).map((m: any) => {
        const e = resolveEmp(m);
        const s = resolveSp(m);
        return {
          ...m,
          // Backfill account ids when missing so the UI can group reliably
          empresa_account_id: m.empresa_account_id ?? e?.id ?? null,
          sponsor_account_id: m.sponsor_account_id ?? s?.id ?? null,
          empresa: e,
          sponsor: s,
          empresa_responsable: pMap.get(m.empresa_user_id) ?? null,
          sponsor_responsable: pMap.get(m.sponsor_user_id) ?? null,
        };
      }),
      allEmpresas: (allEmps ?? []).map((e: any) => ({ id: e.id, company_name: e.company_name, logo_url: e.logo_url })),
      allSponsors: (allSps ?? []).map((s: any) => ({ id: s.id, company_name: s.company_name, logo_url: s.logo_url, sponsorship_level: s.sponsorship_level })),
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
