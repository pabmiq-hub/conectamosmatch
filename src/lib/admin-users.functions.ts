import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin, assertBootstrapAdmin } from "./admin-shared.server";
import { enrichAccountFromDomain } from "./firecrawl.server";

const empresaSchema = z.object({
  company_name: z.string().min(1).max(200),
  sector: z.string().max(120).optional().default(""),
  company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  website: z.string().max(300).optional().default(""),
  location_city: z.string().max(120).optional().default(""),
  linkedin_url: z.string().max(300).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const sponsorSchema = z.object({
  company_name: z.string().min(1).max(200),
  sector: z.string().max(120).optional().default(""),
  sponsorship_category: z.string().max(120).optional().default(""),
  sponsorship_level: z.enum(["GOLD","PREMIUM","BASIC","STARTUP"]).default("BASIC"),
  website: z.string().max(300).optional().default(""),
  linkedin_url: z.string().max(300).optional().default(""),
  tagline: z.string().max(300).optional().default(""),
  description: z.string().max(2000).optional().default(""),
});

const createSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  phone: z.string().max(40).optional().default(""),
  role: z.enum(["empresa", "sponsor"]),
  empresa: empresaSchema.optional(),
  sponsor: sponsorSchema.optional(),
});

async function createOne(d: z.infer<typeof createSchema>) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name, role: d.role },
  });
  if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear");
  const userId = created.user.id;

  let accountId: string | null = null;
  if (d.role === "empresa" && d.empresa) {
    const { data: prof, error: e } = await supabaseAdmin
      .from("empresa_profiles")
      .insert({ user_id: userId, ...d.empresa })
      .select("id")
      .single();
    if (e) throw new Error(e.message);
    accountId = prof.id;
  } else if (d.role === "sponsor" && d.sponsor) {
    const { data: prof, error: e } = await supabaseAdmin
      .from("sponsor_profiles")
      .insert({ user_id: userId, ...d.sponsor })
      .select("id")
      .single();
    if (e) throw new Error(e.message);
    accountId = prof.id;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email: d.email,
    full_name: d.full_name,
    phone: d.phone,
    role: d.role,
    account_id: accountId,
    account_role: "owner",
  });

  // Best-effort auto-enrichment from website / email domain (Firecrawl). Silent on failure.
  if (accountId) {
    const hintUrl = d.role === "empresa" ? d.empresa?.website : d.sponsor?.website;
    try {
      await enrichAccountFromDomain({ supabaseAdmin, accountId, kind: d.role, hintUrl, email: d.email });
    } catch {}
  }

  return userId;
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);
    const userId = await createOne(data);
    return { userId, email: data.email };
  });

// ---- Super admin creation (bootstrap only) ----
const createSuperAdminSchema = z.object({
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
});

export const createSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSuperAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: "super_admin" },
    });
    if (error || !created.user) throw new Response(error?.message ?? "No se pudo crear", { status: 400 });
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email: data.email,
      full_name: data.full_name,
      role: "super_admin",
      account_id: null,
      account_role: undefined,
    });
    return { userId: created.user.id, email: data.email };
  });

// Add a "manager" responsable to an existing account
const inviteResponsableSchema = z.object({
  accountId: z.string().uuid(),
  accountType: z.enum(["empresa", "sponsor"]),
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  phone: z.string().max(40).optional().default(""),
});

export const inviteResponsable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteResponsableSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);

    // Verify account exists
    const table = data.accountType === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    const { data: account, error: accErr } = await supabaseAdmin
      .from(table)
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (accErr || !account) throw new Error("La cuenta no existe");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.accountType },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear");
    const userId = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      role: data.accountType,
      account_id: data.accountId,
      account_role: "manager",
    });

    return { userId, email: data.email };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: emp }, { data: sp }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, company_name").order("company_name"),
      supabaseAdmin.from("sponsor_profiles").select("id, company_name").order("company_name"),
    ]);
    return {
      empresas: (emp ?? []).map((e: any) => ({ id: e.id, name: e.company_name })),
      sponsors: (sp ?? []).map((s: any) => ({ id: s.id, name: s.company_name })),
    };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await supabaseAdmin.from("profiles").update({ is_active: data.isActive }).eq("id", data.userId);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Response("No puedes eliminar tu propia cuenta", { status: 400 });
    }
    // Only owners delete the account profile rows. Managers just lose their auth user.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("account_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (prof?.account_role === "owner") {
      await supabaseAdmin.from("empresa_profiles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("sponsor_profiles").delete().eq("user_id", data.userId);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

const optStr = z.preprocess(
  (v) => (v === undefined || v === null ? "" : String(v)),
  z.string().optional().default(""),
);

// ---- User activity (admin drill-down) ----
export const getUserActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const userId = data.userId;
    const [
      { data: profile },
      { data: likesOut },
      { data: likesIn },
      { data: matches },
      { data: meetings },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, role, account_id, account_role").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("likes").select("to_user_id, created_at, event_id").eq("from_user_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("likes").select("from_user_id, created_at, event_id").eq("to_user_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("matches").select("*").or(`empresa_user_id.eq.${userId},sponsor_user_id.eq.${userId}`).order("created_at", { ascending: false }),
      supabaseAdmin.from("meetings_1to1").select("*").or(`empresa_user_id.eq.${userId},sponsor_user_id.eq.${userId}`).order("scheduled_time", { ascending: true, nullsFirst: false }),
    ]);

    const allUserIds = new Set<string>();
    (likesOut ?? []).forEach((l: any) => l.to_user_id && allUserIds.add(l.to_user_id));
    (likesIn ?? []).forEach((l: any) => l.from_user_id && allUserIds.add(l.from_user_id));
    (matches ?? []).forEach((m: any) => { m.empresa_user_id && allUserIds.add(m.empresa_user_id); m.sponsor_user_id && allUserIds.add(m.sponsor_user_id); });
    (meetings ?? []).forEach((m: any) => { m.empresa_user_id && allUserIds.add(m.empresa_user_id); m.sponsor_user_id && allUserIds.add(m.sponsor_user_id); });
    const idArr = Array.from(allUserIds);
    const [{ data: emps }, { data: sps }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name").in("user_id", idArr.length ? idArr : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name").in("user_id", idArr.length ? idArr : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const nameMap = new Map<string, { name: string; kind: "empresa" | "sponsor" }>();
    (emps ?? []).forEach((e: any) => nameMap.set(e.user_id, { name: e.company_name, kind: "empresa" }));
    (sps ?? []).forEach((s: any) => nameMap.set(s.user_id, { name: s.company_name, kind: "sponsor" }));
    const nameOf = (id?: string | null) => (id ? nameMap.get(id)?.name ?? "—" : "—");
    const kindOf = (id?: string | null) => (id ? nameMap.get(id)?.kind ?? null : null);

    return {
      profile,
      likesOut: (likesOut ?? []).map((l: any) => ({ ...l, target_name: nameOf(l.to_user_id), target_kind: kindOf(l.to_user_id) })),
      likesIn: (likesIn ?? []).map((l: any) => ({ ...l, source_name: nameOf(l.from_user_id), source_kind: kindOf(l.from_user_id) })),
      matches: (matches ?? []).map((m: any) => ({ ...m, empresa_name: nameOf(m.empresa_user_id), sponsor_name: nameOf(m.sponsor_user_id) })),
      meetings: (meetings ?? []).map((m: any) => ({ ...m, empresa_name: nameOf(m.empresa_user_id), sponsor_name: nameOf(m.sponsor_user_id) })),
    };
  });


const accountTypeSchema = z.preprocess((v) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : v;
  if (s === "sponsor" || s === "patrocinador") return "sponsor";
  return "empresa"; // default — Excel "role" column is treated as job title
}, z.enum(["empresa", "sponsor"]));

const bulkRowSchema = z.object({
  full_name: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1)),
  email: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().email()),
  password: z.preprocess(
    (v) => {
      const s = v == null ? "" : String(v);
      return s.length >= 8 ? s : `Cambiar${Math.random().toString(36).slice(2, 10)}!`;
    },
    z.string().min(8),
  ),
  // account_type column drives the role; legacy "role" column is now job title (ignored for routing)
  account_type: accountTypeSchema.optional(),
  role: optStr, // job title (free text), preserved but unused for routing
  phone: optStr,
  company_name: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string().min(1)),
  sector: optStr,
  website: optStr,
  linkedin_url: optStr,
  tagline: optStr,
  description: optStr,
  // empresa
  company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
  location_city: optStr,
  // sponsor
  sponsorship_category: optStr,
  sponsorship_level: z.enum(["GOLD","PREMIUM","BASIC","STARTUP"]).optional(),
});


export const bulkImportUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);
    const ok: string[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const raw of data.rows) {
      try {
        const r = bulkRowSchema.parse(raw);
        const accountType = r.account_type ?? "empresa";
        await createOne({
          full_name: r.full_name,
          email: r.email,
          password: r.password,
          phone: r.phone,
          role: accountType,

          empresa:
            accountType === "empresa"
              ? {
                  company_name: r.company_name,
                  sector: r.sector,
                  company_size: r.company_size,
                  website: r.website,
                  location_city: r.location_city,
                  linkedin_url: r.linkedin_url,
                  tagline: r.tagline,
                  description: r.description,
                }
              : undefined,
          sponsor:
            accountType === "sponsor"
              ? {
                  company_name: r.company_name,
                  sector: r.sector,
                  sponsorship_category: r.sponsorship_category,
                  sponsorship_level: r.sponsorship_level ?? "BASIC",
                  website: r.website,
                  linkedin_url: r.linkedin_url,
                  tagline: r.tagline,
                  description: r.description,
                }
              : undefined,
        });
        ok.push(r.email);
      } catch (e: any) {
        failed.push({ email: String(raw.email ?? "(?)"), error: e?.message ?? "Error desconocido" });
      }
    }
    return { ok, failed };
  });

// ---- Bulk operations ----

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const sym = "!@#$%&*";
  let out = "";
  for (let i = 0; i < len - 1; i++) out += chars[Math.floor(Math.random() * chars.length)];
  out += sym[Math.floor(Math.random() * sym.length)];
  return out;
}

export const bulkDeleteUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ exceptIds: z.array(z.string().uuid()).default([]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const except = new Set<string>([context.userId, ...data.exceptIds]); // never self
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, role, account_role");
    const targets = (profs ?? []).filter(
      (p: any) => p.role !== "super_admin" && !except.has(p.id),
    );
    let deleted = 0;
    const failed: { userId: string; error: string }[] = [];
    for (const p of targets as any[]) {
      try {
        if (p.account_role === "owner") {
          await supabaseAdmin.from("empresa_profiles").delete().eq("user_id", p.id);
          await supabaseAdmin.from("sponsor_profiles").delete().eq("user_id", p.id);
        }
        const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id);
        if (error) throw new Error(error.message);
        deleted++;
      } catch (e: any) {
        failed.push({ userId: p.id, error: e?.message ?? "Error" });
      }
    }
    return { deleted, failed, total: targets.length };
  });

export const bulkResetPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ exceptIds: z.array(z.string().uuid()).default([]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const except = new Set<string>([context.userId, ...data.exceptIds]);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, phone, role, account_id");
    const targets = (profs ?? []).filter(
      (p: any) => p.role !== "super_admin" && !except.has(p.id),
    );
    const results: { userId: string; email: string; full_name: string; role: string; password: string; ok: boolean; error?: string }[] = [];
    for (const p of targets as any[]) {
      const password = generatePassword(12);
      try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(p.id, { password });
        if (error) throw new Error(error.message);
        results.push({ userId: p.id, email: p.email ?? "", full_name: p.full_name ?? "", role: p.role, password, ok: true });
      } catch (e: any) {
        results.push({ userId: p.id, email: p.email ?? "", full_name: p.full_name ?? "", role: p.role, password: "", ok: false, error: e?.message });
      }
    }
    return { results };
  });

export const exportAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: profs }, { data: emps }, { data: sps }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, phone, role, account_id, account_role, is_active, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("empresa_profiles").select("*"),
      supabaseAdmin.from("sponsor_profiles").select("*"),
    ]);
    const empById = new Map((emps ?? []).map((e: any) => [e.id, e]));
    const spById = new Map((sps ?? []).map((s: any) => [s.id, s]));
    const rows = (profs ?? []).map((p: any) => {
      const company: any = p.role === "empresa" ? empById.get(p.account_id) : p.role === "sponsor" ? spById.get(p.account_id) : null;
      return {
        user_id: p.id,
        email: p.email ?? "",
        full_name: p.full_name ?? "",
        phone: p.phone ?? "",
        role: p.role,
        account_role: p.account_role ?? "",
        is_active: p.is_active,
        created_at: p.created_at,
        company_name: company?.company_name ?? "",
        sector: company?.sector ?? "",
        website: company?.website ?? "",
        linkedin_url: company?.linkedin_url ?? "",
        tagline: company?.tagline ?? "",
        description: company?.description ?? "",
        company_size: company?.company_size ?? "",
        location_city: company?.location_city ?? "",
        sponsorship_level: company?.sponsorship_level ?? "",
        sponsorship_category: company?.sponsorship_category ?? "",
        categories: Array.isArray(company?.categories) ? company.categories.join(" | ") : "",
      };
    });
    return { rows };
  });

// =====================================================================
// ============ Grouped Excel import (multi-responsable) ===============
// =====================================================================

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(s\.?l\.?|s\.?a\.?|s\.?l\.?u\.?|inc\.?|ltd\.?|llc|corp\.?|gmbh|sas|bv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function emailDomain(email: string) {
  const at = email.indexOf("@");
  return at > -1 ? email.slice(at + 1).toLowerCase().trim() : "";
}

const GENERIC_DOMAINS = new Set([
  "gmail.com","hotmail.com","outlook.com","yahoo.com","yahoo.es","icloud.com",
  "live.com","msn.com","aol.com","protonmail.com","proton.me","gmx.com","gmx.es",
  "me.com","mac.com","fastmail.com","zoho.com","mail.com",
]);

export const analyzeExcelGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);

    type Parsed = {
      idx: number;
      raw: Record<string, unknown>;
      ok: boolean;
      error?: string;
      row?: z.infer<typeof bulkRowSchema>;
      normalized_company?: string;
      domain?: string;
    };

    const parsed: Parsed[] = data.rows.map((raw, idx) => {
      try {
        const row = bulkRowSchema.parse(raw);
        return {
          idx, raw, ok: true, row,
          normalized_company: normalizeName(row.company_name),
          domain: emailDomain(row.email),
        };
      } catch (e: any) {
        return { idx, raw, ok: false, error: e?.message ?? "Fila inválida" };
      }
    });

    type Group = {
      id: string;
      account_type: "empresa" | "sponsor";
      company_name: string;
      normalized: string;
      members: Parsed[];
    };
    const groups: Group[] = [];

    function findGroup(p: Parsed): Group | undefined {
      const type = p.row!.account_type ?? "empresa";
      for (const g of groups) {
        if (g.account_type !== type) continue;
        if (g.normalized && g.normalized === p.normalized_company) return g;
        if (p.domain && !GENERIC_DOMAINS.has(p.domain)) {
          if (g.members.some((m) => m.domain === p.domain)) return g;
        }
      }
      return undefined;
    }

    for (const p of parsed) {
      if (!p.ok) continue;
      const type = p.row!.account_type ?? "empresa";
      const existing = findGroup(p);
      if (existing) {
        existing.members.push(p);
      } else {
        groups.push({
          id: `g${groups.length + 1}`,
          account_type: type,
          company_name: p.row!.company_name,
          normalized: p.normalized_company ?? "",
          members: [p],
        });
      }
    }

    const out_groups = groups.map((g) => ({
      id: g.id,
      account_type: g.account_type,
      suggested_company_name: g.company_name,
      members: g.members.map((m, i) => ({
        idx: m.idx,
        full_name: m.row!.full_name,
        email: m.row!.email,
        phone: m.row!.phone,
        suggested_admin: i === 0,
      })),
      account_fields: {
        sector: g.members[0].row!.sector,
        website: g.members[0].row!.website,
        linkedin_url: g.members[0].row!.linkedin_url,
        tagline: g.members[0].row!.tagline,
        description: g.members[0].row!.description,
        company_size: g.members[0].row!.company_size,
        location_city: g.members[0].row!.location_city,
        sponsorship_category: g.members[0].row!.sponsorship_category,
        sponsorship_level: g.members[0].row!.sponsorship_level,
      },
    }));

    const errors = parsed.filter((p) => !p.ok).map((p) => ({
      idx: p.idx,
      email: String((p.raw as any).email ?? "(?)"),
      error: p.error ?? "Error",
    }));

    const rows_by_idx: Record<string, z.infer<typeof bulkRowSchema>> = {};
    for (const p of parsed) if (p.ok && p.row) rows_by_idx[String(p.idx)] = p.row;

    return { groups: out_groups, errors, rows_by_idx };
  });

const confirmedGroupSchema = z.object({
  account_type: z.enum(["empresa", "sponsor"]),
  company_name: z.string().min(1).max(200),
  admin_idx: z.number().int().nonnegative(),
  member_idxs: z.array(z.number().int().nonnegative()).min(1),
  account_fields: z.object({
    sector: z.string().optional().default(""),
    website: z.string().optional().default(""),
    linkedin_url: z.string().optional().default(""),
    tagline: z.string().optional().default(""),
    description: z.string().optional().default(""),
    company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
    location_city: z.string().optional().default(""),
    sponsorship_category: z.string().optional().default(""),
    sponsorship_level: z.enum(["GOLD","PREMIUM","BASIC","STARTUP"]).optional(),
  }),
});

export const confirmGroupedImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      groups: z.array(confirmedGroupSchema).min(1).max(200),
      rows_by_idx: z.record(z.string(), z.any()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBootstrapAdmin(context.userId);

    const created_accounts: { account_id: string; company_name: string; members: { email: string; role: string }[] }[] = [];
    const failed: { email: string; error: string }[] = [];

    const processGroup = async (g: typeof data.groups[number]) => {
      try {
        let accountId: string;
        if (g.account_type === "empresa") {
          const { data: prof, error: e } = await supabaseAdmin
            .from("empresa_profiles")
            .insert({
              company_name: g.company_name,
              sector: g.account_fields.sector ?? "",
              website: g.account_fields.website ?? "",
              linkedin_url: g.account_fields.linkedin_url ?? "",
              tagline: g.account_fields.tagline ?? "",
              description: g.account_fields.description ?? "",
              company_size: g.account_fields.company_size,
              location_city: g.account_fields.location_city ?? "",
            })
            .select("id")
            .single();
          if (e) throw new Error(e.message);
          accountId = prof.id;
        } else {
          const { data: prof, error: e } = await supabaseAdmin
            .from("sponsor_profiles")
            .insert({
              company_name: g.company_name,
              sector: g.account_fields.sector ?? "",
              website: g.account_fields.website ?? "",
              linkedin_url: g.account_fields.linkedin_url ?? "",
              tagline: g.account_fields.tagline ?? "",
              description: g.account_fields.description ?? "",
              sponsorship_category: g.account_fields.sponsorship_category ?? "",
              sponsorship_level: (g.account_fields.sponsorship_level as any) ?? "BASIC",
            })
            .select("id")
            .single();
          if (e) throw new Error(e.message);
          accountId = prof.id;
        }

        const members: { email: string; role: string }[] = [];
        let ownerSetUserId: string | null = null;
        for (const idx of g.member_idxs) {
          const raw = data.rows_by_idx[String(idx)];
          let r: z.infer<typeof bulkRowSchema>;
          try {
            r = bulkRowSchema.parse(raw);
          } catch (e: any) {
            failed.push({ email: String(raw?.email ?? "(?)"), error: e?.message ?? "Datos inválidos" });
            continue;
          }
          try {
            const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
              email: r.email,
              password: r.password,
              email_confirm: true,
              user_metadata: { full_name: r.full_name, role: g.account_type },
            });
            if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear usuario");
            const userId = created.user.id;

            const isAdmin = idx === g.admin_idx;
            const account_role = isAdmin ? "owner" : "manager";
            if (isAdmin) ownerSetUserId = userId;

            await supabaseAdmin.from("profiles").upsert({
              id: userId,
              email: r.email,
              full_name: r.full_name,
              phone: r.phone,
              role: g.account_type,
              account_id: accountId,
              account_role,
            });

            members.push({ email: r.email, role: account_role });
          } catch (e: any) {
            failed.push({ email: r.email, error: e?.message ?? "Error" });
          }
        }

        if (ownerSetUserId) {
          if (g.account_type === "empresa") {
            await supabaseAdmin.from("empresa_profiles").update({ user_id: ownerSetUserId }).eq("id", accountId);
          } else {
            await supabaseAdmin.from("sponsor_profiles").update({ user_id: ownerSetUserId }).eq("id", accountId);
          }
        }

        created_accounts.push({ account_id: accountId, company_name: g.company_name, members });
      } catch (e: any) {
        failed.push({ email: g.company_name, error: e?.message ?? "Error creando cuenta" });
      }
    };

    // Process groups in parallel chunks. Sequential was timing out the worker
    // on large imports (50+ accounts × auth.admin.createUser latency).
    const CONCURRENCY = 6;
    for (let i = 0; i < data.groups.length; i += CONCURRENCY) {
      const chunk = data.groups.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(processGroup));
    }


    return { created_accounts, failed };
  });

// =====================================================================
// ============ Responsable management (super admin) ===================
// =====================================================================

export const transferAccountAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ newAdminUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, role, account_id")
      .eq("id", data.newAdminUserId)
      .maybeSingle();
    if (!target?.account_id) throw new Response("El usuario no pertenece a una cuenta", { status: 400 });

    await supabaseAdmin
      .from("profiles")
      .update({ account_role: "manager" })
      .eq("account_id", target.account_id)
      .eq("account_role", "owner");

    await supabaseAdmin
      .from("profiles")
      .update({ account_role: "owner" })
      .eq("id", data.newAdminUserId);

    const table = target.role === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    await supabaseAdmin.from(table).update({ user_id: data.newAdminUserId }).eq("id", target.account_id);

    return { ok: true };
  });

export const moveResponsableToAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      targetAccountId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, role, account_id, account_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof) throw new Response("Usuario no encontrado", { status: 404 });

    const table = prof.role === "empresa" ? "empresa_profiles" : "sponsor_profiles";
    const { data: target } = await supabaseAdmin
      .from(table)
      .select("id, user_id")
      .eq("id", data.targetAccountId)
      .maybeSingle();
    if (!target) throw new Response("Cuenta destino no encontrada", { status: 404 });

    if (prof.account_role === "owner" && prof.account_id) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", prof.account_id);
      if ((count ?? 0) <= 1) {
        throw new Response(
          "No puedes mover al único miembro de una cuenta. Elimina la cuenta antes o añade otro responsable.",
          { status: 400 },
        );
      }
      const { data: replacement } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("account_id", prof.account_id)
        .neq("id", data.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (replacement) {
        await supabaseAdmin.from("profiles").update({ account_role: "owner" }).eq("id", replacement.id);
        await supabaseAdmin.from(table).update({ user_id: replacement.id }).eq("id", prof.account_id);
      }
    }

    await supabaseAdmin
      .from("profiles")
      .update({ account_id: data.targetAccountId, account_role: "manager" })
      .eq("id", data.userId);

    return { ok: true };
  });

export const removeResponsableFromAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), deleteUser: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) {
      throw new Response("No puedes eliminarte a ti mismo", { status: 400 });
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, role, account_id, account_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof) throw new Response("Usuario no encontrado", { status: 404 });

    if (prof.account_role === "owner" && prof.account_id) {
      const { data: replacement } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("account_id", prof.account_id)
        .neq("id", data.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (replacement) {
        await supabaseAdmin.from("profiles").update({ account_role: "owner" }).eq("id", replacement.id);
        const table = prof.role === "empresa" ? "empresa_profiles" : "sponsor_profiles";
        await supabaseAdmin.from(table).update({ user_id: replacement.id }).eq("id", prof.account_id);
      }
    }

    if (data.deleteUser) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({ account_id: null, account_role: "manager" })
        .eq("id", data.userId);
    }
    return { ok: true };
  });

// =====================================================================
// ============ Sponsor → Empresa account-level likes ==================
// =====================================================================

export const listEmpresaResponsables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ empresaUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Use admin client to bypass RLS — sponsors need to see responsables of other accounts
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("account_id, role")
      .eq("id", data.empresaUserId)
      .maybeSingle();

    // Helper to look up cargo from account's responsables jsonb by email match
    async function loadCargoMap(accountId: string | null, role: string | null): Promise<Map<string, string>> {
      const map = new Map<string, string>();
      if (!accountId) return map;
      const table = role === "sponsor" ? "sponsor_profiles" : "empresa_profiles";
      const { data: acc } = await (supabaseAdmin.from(table) as any)
        .select("responsables")
        .eq("id", accountId)
        .maybeSingle();
      const list = Array.isArray(acc?.responsables) ? acc.responsables : [];
      for (const r of list) {
        const email = String(r?.email ?? "").trim().toLowerCase();
        const cargo = String(r?.role ?? "").trim();
        if (email && cargo) map.set(email, cargo);
      }
      return map;
    }

    if (!target?.account_id) {
      const { data: solo } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, account_role")
        .eq("id", data.empresaUserId)
        .maybeSingle();
      const myLikesSolo = solo
        ? await supabaseAdmin.from("likes").select("to_user_id").eq("from_user_id", userId).eq("to_user_id", solo.id)
        : { data: [] as any[] };
      return {
        responsables: solo ? [{ ...solo, cargo: null }] : [],
        myExistingLikes: (myLikesSolo.data ?? []).map((l: any) => l.to_user_id),
      };
    }
    const { data: members } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, account_role")
      .eq("account_id", target.account_id)
      .eq("is_active", true);
    const ids = (members ?? []).map((m: any) => m.id);
    if (!ids.length) return { responsables: [], myExistingLikes: [] as string[] };
    const cargoMap = await loadCargoMap(target.account_id, target.role);
    const enriched = (members ?? []).map((m: any) => ({
      ...m,
      cargo: cargoMap.get(String(m.email ?? "").trim().toLowerCase()) ?? null,
    }));
    const { data: myLikes } = await supabaseAdmin
      .from("likes")
      .select("to_user_id")
      .eq("from_user_id", userId)
      .in("to_user_id", ids);
    return {
      responsables: enriched,
      myExistingLikes: (myLikes ?? []).map((l: any) => l.to_user_id),
    };
  });

export const likeEmpresaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      responsableIds: z.array(z.string().uuid()).min(1).max(50),
      eventId: z.string().uuid().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.responsableIds.map((toId) => ({
      from_user_id: userId,
      to_user_id: toId,
      event_id: data.eventId,
    }));
    let inserted = 0;
    for (const row of rows) {
      const { error } = await supabase.from("likes").insert(row);
      if (!error) inserted++;
      // Silently ignore duplicates/conflicts
    }
    return { ok: true, count: inserted };
  });

// =====================================================================
// ============ Edit user + account (super admin) ======================
// =====================================================================

const editUserSchema = z.object({
  userId: z.string().uuid(),
  // profile
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().default(""),
  is_active: z.boolean().optional(),
  // account fields (apply only if the user is owner of an account)
  account: z
    .object({
      company_name: z.string().max(200).optional(),
      sector: z.string().max(120).optional(),
      website: z.string().max(300).optional(),
      linkedin_url: z.string().max(300).optional(),
      tagline: z.string().max(300).optional(),
      description: z.string().max(2000).optional(),
      location_city: z.string().max(120).optional(),
      company_size: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).optional(),
      sponsorship_category: z.string().max(120).optional(),
      sponsorship_level: z.enum(["GOLD", "PREMIUM", "BASIC", "STARTUP"]).optional(),
      logo_url: z.string().max(1000).nullable().optional(),
    })
    .optional(),
});

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, account_id, account_role")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof) throw new Response("Usuario no encontrado", { status: 404 });

    // Update auth email if changed
    if (data.email && data.email !== prof.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email });
      if (error) throw new Response(error.message, { status: 400 });
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        ...(typeof data.is_active === "boolean" ? { is_active: data.is_active } : {}),
      })
      .eq("id", data.userId);

    if (data.account && prof.account_id) {
      const table = prof.role === "empresa" ? "empresa_profiles" : prof.role === "sponsor" ? "sponsor_profiles" : null;
      if (table) {
        const patch: Record<string, any> = {};
        if (data.account.company_name !== undefined) patch.company_name = data.account.company_name;
        if (data.account.sector !== undefined) patch.sector = data.account.sector;
        if (data.account.website !== undefined) patch.website = data.account.website;
        if (data.account.linkedin_url !== undefined) patch.linkedin_url = data.account.linkedin_url;
        if (data.account.tagline !== undefined) patch.tagline = data.account.tagline;
        if (data.account.description !== undefined) patch.description = data.account.description;
        if (data.account.logo_url !== undefined) patch.logo_url = data.account.logo_url;
        if (table === "empresa_profiles") {
          if (data.account.location_city !== undefined) patch.location_city = data.account.location_city;
          if (data.account.company_size !== undefined) patch.company_size = data.account.company_size;
        } else {
          if (data.account.sponsorship_category !== undefined) patch.sponsorship_category = data.account.sponsorship_category;
          if (data.account.sponsorship_level !== undefined) patch.sponsorship_level = data.account.sponsorship_level;
        }
        if (Object.keys(patch).length) {
          await (supabaseAdmin.from(table) as any).update(patch).eq("id", prof.account_id);
        }
      }
    }
    return { ok: true };
  });

export const getUserForEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, phone, role, account_id, account_role, is_active")
      .eq("id", data.userId)
      .maybeSingle();
    if (!prof) throw new Response("Usuario no encontrado", { status: 404 });
    let account: any = null;
    if (prof.account_id && prof.role === "empresa") {
      const { data: e } = await supabaseAdmin.from("empresa_profiles").select("*").eq("id", prof.account_id).maybeSingle();
      account = e;
    } else if (prof.account_id && prof.role === "sponsor") {
      const { data: s } = await supabaseAdmin.from("sponsor_profiles").select("*").eq("id", prof.account_id).maybeSingle();
      account = s;
    }
    return { profile: prof, account };
  });


