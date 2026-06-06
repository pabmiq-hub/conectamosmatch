import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

type AccountKind = "empresa" | "sponsor";
type AccountRef = { id: string; company_name: string; logo_url?: string | null };
type TargetAgg = {
  account_id: string;
  company_name: string;
  kind: AccountKind;
  responsables: string[]; // names of responsables (in source account) who liked someone in this target account
  created_at: string | null; // most recent like
};
type SourceAgg = {
  account_id: string;
  company_name: string;
  kind: AccountKind;
  logo_url?: string | null;
  total: number; // unique target accounts
  targets: TargetAgg[];
};

export const listAccountSelections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    const [{ data: emps }, { data: sps }, { data: profs }, { data: likes }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name, logo_url"),
      supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name, logo_url"),
      supabaseAdmin.from("profiles").select("id, account_id, role, full_name"),
      supabaseAdmin.from("likes").select("from_user_id, to_user_id, created_at").order("created_at", { ascending: false }),
    ]);

    // user_id -> { account_id, kind, responsable_name }
    const userMap = new Map<string, { account_id: string; kind: AccountKind; name: string }>();
    const empAccounts = new Map<string, AccountRef & { kind: AccountKind }>();
    const spAccounts = new Map<string, AccountRef & { kind: AccountKind }>();
    (emps ?? []).forEach((e: any) => {
      empAccounts.set(e.id, { id: e.id, company_name: e.company_name, logo_url: e.logo_url, kind: "empresa" });
    });
    (sps ?? []).forEach((s: any) => {
      spAccounts.set(s.id, { id: s.id, company_name: s.company_name, logo_url: s.logo_url, kind: "sponsor" });
    });
    (profs ?? []).forEach((p: any) => {
      if (!p.account_id) return;
      const kind: AccountKind | null = empAccounts.has(p.account_id) ? "empresa" : spAccounts.has(p.account_id) ? "sponsor" : null;
      if (!kind) return;
      userMap.set(p.id, { account_id: p.account_id, kind, name: p.full_name || "Responsable" });
    });

    // Aggregate likes by source account -> target account
    // key: srcAccountId -> Map<targetAccountId, { kind, names: Set, created_at: latest }>
    const agg = new Map<string, Map<string, { kind: AccountKind; names: Set<string>; created_at: string | null }>>();

    (likes ?? []).forEach((l: any) => {
      const src = userMap.get(l.from_user_id);
      const tgt = userMap.get(l.to_user_id);
      if (!src || !tgt) return;
      if (src.account_id === tgt.account_id) return;
      let m = agg.get(src.account_id);
      if (!m) { m = new Map(); agg.set(src.account_id, m); }
      let t = m.get(tgt.account_id);
      if (!t) { t = { kind: tgt.kind, names: new Set(), created_at: l.created_at }; m.set(tgt.account_id, t); }
      t.names.add(src.name);
      if (l.created_at && (!t.created_at || l.created_at > t.created_at)) t.created_at = l.created_at;
    });

    const buildSource = (acc: AccountRef & { kind: AccountKind }): SourceAgg => {
      const targets = agg.get(acc.id) ?? new Map();
      const list: TargetAgg[] = [];
      targets.forEach((v, targetId) => {
        const ref = v.kind === "empresa" ? empAccounts.get(targetId) : spAccounts.get(targetId);
        list.push({
          account_id: targetId,
          company_name: ref?.company_name ?? "—",
          kind: v.kind,
          responsables: (Array.from(v.names) as string[]).sort((a, b) => a.localeCompare(b, "es")),
          created_at: v.created_at,
        });
      });
      list.sort((a, b) => a.company_name.localeCompare(b.company_name, "es"));
      return {
        account_id: acc.id,
        company_name: acc.company_name,
        kind: acc.kind,
        logo_url: acc.logo_url,
        total: list.length,
        targets: list,
      };
    };

    const empresas = Array.from(empAccounts.values()).map(buildSource)
      .sort((a, b) => (b.total - a.total) || a.company_name.localeCompare(b.company_name, "es"));
    const sponsors = Array.from(spAccounts.values()).map(buildSource)
      .sort((a, b) => (b.total - a.total) || a.company_name.localeCompare(b.company_name, "es"));

    return { empresas, sponsors };
  });
