import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountLinkIssues, resolveAccountOwner, type LinkIssue } from "./account-owner";

export type AccountHealthRow = {
  account_id: string;
  kind: "empresa" | "sponsor";
  company_name: string;
  issues: LinkIssue[];
  /** Member that can be set as responsable automatically, if any. */
  suggested_user_id: string | null;
  suggested_name: string | null;
};

async function loadAll(db: any) {
  const page = async (table: string, cols: string) => {
    const out: any[] = [];
    for (let f = 0; ; f += 1000) {
      const { data, error } = await db.from(table).select(cols).range(f, f + 999);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const [emps, sps, profs] = await Promise.all([
    page("empresa_profiles", "id, user_id, company_name"),
    page("sponsor_profiles", "id, user_id, company_name"),
    page("profiles", "id, account_id, account_role, is_active, full_name, email"),
  ]);
  return { emps, sps, profs };
}

export const listAccountHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertSuperAdmin } = await import("./admin-shared.server");
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { emps, sps, profs } = await loadAll(db);
    const byId = new Map(profs.map((p: any) => [p.id, p]));
    const rows: AccountHealthRow[] = [];
    const check = (a: any, kind: "empresa" | "sponsor") => {
      const issues = accountLinkIssues(a, profs);
      if (!issues.length) return;
      const sug = resolveAccountOwner({ id: a.id, user_id: null }, profs);
      const p: any = sug ? byId.get(sug) : null;
      rows.push({ account_id: a.id, kind, company_name: a.company_name, issues, suggested_user_id: sug, suggested_name: p ? p.full_name || p.email : null });
    };
    emps.forEach((a) => check(a, "empresa"));
    sps.forEach((a) => check(a, "sponsor"));
    rows.sort((x, y) => x.company_name.localeCompare(y.company_name, "es"));
    const { data: regs } = await db.from("event_registrations").select("id, event_id, attendee_name, attendee_email, attendee_company, user_id").neq("status", "cancelled");
    const orphanRegs = (regs ?? []).filter((r: any) => !r.user_id || !byId.has(r.user_id));
    return { total: emps.length + sps.length, accounts: rows, orphanRegistrations: orphanRegs };
  });

export const fixAccountResponsable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ account_id: z.string().uuid(), kind: z.enum(["empresa", "sponsor"]), user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin } = await import("./admin-shared.server");
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: p } = await db.from("profiles").select("id, account_id").eq("id", data.user_id).maybeSingle();
    if (!p || p.account_id !== data.account_id) throw new Error("Ese usuario no pertenece a esta cuenta");
    const table = data.kind === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    const { error } = await db.from(table).update({ user_id: data.user_id }).eq("id", data.account_id);
    if (error) throw new Error(error.message);
    await db.from("profiles").update({ account_role: "owner" }).eq("id", data.user_id);
    return { ok: true };
  });
