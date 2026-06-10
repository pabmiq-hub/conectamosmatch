import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertSuperAdmin } from "./admin-shared.server";

export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional().nullable() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    let q = supabaseAdmin.from("meetings_1to1").select("*").order("scheduled_time", { ascending: true, nullsFirst: false });
    if (data.event_id) q = q.eq("event_id", data.event_id);
    const { data: meetings, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    // Build account_id -> company_name maps via owners
    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name"),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name"),
      supabaseAdmin.from("profiles").select("id, account_id"),
    ]);
    const profAcc = new Map((profs ?? []).map((p: any) => [p.id, p.account_id]));
    const empAccName = new Map<string, string>();
    (emps ?? []).forEach((e: any) => { const a = profAcc.get(e.user_id); if (a) empAccName.set(a, e.company_name); });
    const spAccName = new Map<string, string>();
    (sps ?? []).forEach((s: any) => { const a = profAcc.get(s.user_id); if (a) spAccName.set(a, s.company_name); });
    const empOwnerName = new Map((emps ?? []).map((e: any) => [e.user_id, e.company_name]));
    const spOwnerName = new Map((sps ?? []).map((s: any) => [s.user_id, s.company_name]));

    return {
      meetings: (meetings ?? []).map((m: any) => {
        const eAcc = m.empresa_account_id ?? profAcc.get(m.empresa_user_id);
        const sAcc = m.sponsor_account_id ?? profAcc.get(m.sponsor_user_id);
        return {
          ...m,
          empresa_name: (eAcc && empAccName.get(eAcc)) ?? empOwnerName.get(m.empresa_user_id) ?? "—",
          sponsor_name: (sAcc && spAccName.get(sAcc)) ?? spOwnerName.get(m.sponsor_user_id) ?? "—",
        };
      }),
    };
  });

export const autoAssignSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("assign_meeting_slots", { p_event_id: data.event_id });
    if (error) throw new Response(error.message, { status: 400 });
    const row = Array.isArray(result) ? result[0] : result;
    return { assigned: row?.assigned ?? 0, skipped: row?.skipped ?? 0 };
  });

export const updateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            scheduled_time: z.string().optional().nullable(),
            room: z.string().max(120).optional().nullable(),
            duration_minutes: z.number().int().min(5).max(180).optional(),
            status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
            notes: z.string().max(2000).optional().nullable(),
          })
          .partial(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("meetings_1to1")
      .update({ ...data.patch, assigned_by: context.userId })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { meeting: m };
  });

export const deleteMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("meetings_1to1").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const clearMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error, count } = await supabaseAdmin
      .from("meetings_1to1")
      .delete({ count: "exact" })
      .eq("event_id", data.event_id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, deleted: count ?? 0 };
  });

const responsableSchema = z.object({
  full_name: z.string().min(1).max(200),
  role: z.string().max(200).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
}).nullable().optional();

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      event_id: z.string().uuid().optional().nullable(),
      empresa_user_id: z.string().uuid(),
      sponsor_user_id: z.string().uuid(),
      scheduled_time: z.string().optional().nullable(),
      room: z.string().max(120).optional().nullable(),
      duration_minutes: z.number().int().min(5).max(180).optional(),
      empresa_responsable: responsableSchema,
      sponsor_responsable: responsableSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    // Resolve account ids for both sides so dashboards can filter by account
    const { data: pr } = await supabaseAdmin
      .from("profiles")
      .select("id, account_id")
      .in("id", [data.empresa_user_id, data.sponsor_user_id]);
    const accMap = new Map((pr ?? []).map((p: any) => [p.id, p.account_id]));

    const { data: m, error } = await supabaseAdmin
      .from("meetings_1to1")
      .insert({
        event_id: data.event_id ?? null,
        empresa_user_id: data.empresa_user_id,
        sponsor_user_id: data.sponsor_user_id,
        empresa_account_id: accMap.get(data.empresa_user_id) ?? null,
        sponsor_account_id: accMap.get(data.sponsor_user_id) ?? null,
        scheduled_time: data.scheduled_time ?? null,
        room: data.room ?? null,
        duration_minutes: data.duration_minutes ?? 15,
        status: data.scheduled_time ? "confirmed" : "pending",
        assigned_by: context.userId,
        empresa_responsable: data.empresa_responsable ?? null,
        sponsor_responsable: data.sponsor_responsable ?? null,
      })
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 400 });
    return { meeting: m };
  });

export const listAllParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("user_id, company_name").order("company_name"),
      supabaseAdmin.from("sponsor_profiles").select("user_id, company_name").order("company_name"),
      supabaseAdmin.from("profiles").select("id, account_id, full_name, email, account_role, role, is_active"),
    ]);

    const ownerAccount = new Map<string, string>();
    const byAccount = new Map<string, any[]>();
    (profs ?? []).forEach((p: any) => {
      if (!p.account_id) return;
      if (p.is_active === false) return;
      const arr = byAccount.get(p.account_id) ?? [];
      arr.push(p);
      byAccount.set(p.account_id, arr);
      ownerAccount.set(p.id, p.account_id);
    });

    const buildResp = (ownerUserId: string) => {
      const accId = ownerAccount.get(ownerUserId);
      if (!accId) return [];
      const members = (byAccount.get(accId) ?? []).slice();
      members.sort((a, b) => (a.account_role === "owner" ? -1 : b.account_role === "owner" ? 1 : 0));
      return members.map((m: any) => ({
        profile_id: m.id,
        full_name: m.full_name ?? "(sin nombre)",
        role: m.account_role ?? "",
        email: m.email ?? "",
      }));
    };

    return {
      empresas: (emps ?? []).filter((e: any) => e.user_id).map((e: any) => ({
        user_id: e.user_id, name: e.company_name, responsables: buildResp(e.user_id),
      })),
      sponsors: (sps ?? []).filter((s: any) => s.user_id).map((s: any) => ({
        user_id: s.user_id, name: s.company_name, responsables: buildResp(s.user_id),
      })),
    };
  });

// ------------------------------------------------------------------
// Bulk import from Excel (rows pre-parsed on the client)
// ------------------------------------------------------------------

const importRowSchema = z.object({
  empresa: z.string().min(1),
  responsable_empresa: z.string().optional().nullable(),
  slot: z.string().optional().nullable(),
  bloque: z.string().optional().nullable(),
  dia: z.number().int().min(1).max(10),
  hora: z.string().min(1),
  mesa: z.union([z.string(), z.number()]).optional().nullable(),
  submesa: z.string().optional().nullable(),
  sponsor: z.string().min(1),
  tipo_sponsor: z.string().optional().nullable(),
  tipo_match: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
});

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOPWORDS = new Set([
  "the", "el", "la", "los", "las", "de", "del", "and", "y",
  "sl", "slu", "sa", "sau", "srl", "ltd", "llc", "inc",
  "iberia", "seguros", "hr", "group", "espana", "recruiting",
]);
const compact = (s: string | null | undefined) =>
  norm(s).split(" ").filter((w) => w && !STOPWORDS.has(w)).join("");

const KNOWN_COMPANY_ALIASES: Record<string, string> = {
  dkv: "dkvseguros",
  informationlab: "theinformationlab",
  leeeters: "leeters",
  leeters: "leeters",
  beamhr: "beam",
  speex: "speexx",
  jobtalent: "jobandtalent",
  jobandtalent: "jobandtalent",
  fingerprintbiometrics: "fingerprintbiometrics",
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function buildNameIndex<T extends { company_name: string }>(items: T[]) {
  const exact = new Map<string, T>();
  const compactMap = new Map<string, T>();
  const all: { item: T; n: string; c: string }[] = [];
  for (const it of items) {
    const n = norm(it.company_name);
    const c = compact(it.company_name);
    if (n) exact.set(n, it);
    if (c) compactMap.set(c, it);
    all.push({ item: it, n, c });
  }
  return (query: string): T | null => {
    const qn = norm(query);
    if (!qn) return null;
    const e = exact.get(qn); if (e) return e;
    const qc = compact(query);
    const ec = compactMap.get(qc); if (ec) return ec;
    const alias = KNOWN_COMPANY_ALIASES[qc];
    if (alias) {
      const aliasMatch = compactMap.get(alias) ?? all.find((x) => x.c === alias || x.c.includes(alias) || alias.includes(x.c))?.item;
      if (aliasMatch) return aliasMatch;
    }
    if (qc.length >= 4) {
      const sub = all.find((x) => x.c && Math.min(x.c.length, qc.length) >= 4 && (x.c.includes(qc) || qc.includes(x.c)));
      if (sub) return sub.item;
    }
    let best: { item: T; d: number } | null = null;
    for (const x of all) {
      if (!x.c) continue;
      const maxLen = Math.max(x.c.length, qc.length);
      const tol = Math.min(3, Math.max(1, Math.floor(maxLen * 0.25)));
      const d = levenshtein(x.c, qc);
      if (d <= tol && (!best || d < best.d)) best = { item: x.item, d };
    }
    return best?.item ?? null;
  };
}

function madridIso(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`);
  const tzName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "short" })
    .formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "CET";
  const offset = tzName === "CEST" ? "+02:00" : "+01:00";
  return new Date(`${dateStr}T${timeStr}:00${offset}`).toISOString();
}

export const importMeetingsFromExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      event_id: z.string().uuid(),
      day_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(10),
      replace_all: z.boolean().optional().default(false),
      rows: z.array(importRowSchema).min(1).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name"),
      supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name"),
      supabaseAdmin.from("profiles").select("id, account_id, full_name, email, account_role, role, is_active"),
    ]);

    const findEmpresa = buildNameIndex(emps ?? []);
    const findSponsor = buildNameIndex(sps ?? []);

    const profByAccount = new Map<string, any[]>();
    (profs ?? []).forEach((p: any) => {
      if (!p.account_id) return;
      const arr = profByAccount.get(p.account_id) ?? [];
      arr.push(p);
      profByAccount.set(p.account_id, arr);
    });

    function resolveResp(accountId: string, ownerUserId: string | null, fullName: string | null) {
      const members = profByAccount.get(accountId) ?? [];
      const active = members.filter((m) => m.is_active !== false);
      if (fullName) {
        const target = norm(fullName);
        const exact = active.find((m) => norm(m.full_name) === target);
        if (exact) return exact;
        const partial = active.find((m) => norm(m.full_name).includes(target) || target.includes(norm(m.full_name)));
        if (partial) return partial;
      }
      const owner = active.find((m) => m.id === ownerUserId);
      if (owner) return owner;
      if (active[0]) return active[0];
      return null;
    }

    if (data.replace_all) {
      const { error: delErr } = await supabaseAdmin.from("meetings_1to1").delete().eq("event_id", data.event_id);
      if (delErr) throw new Response(delErr.message, { status: 400 });
    }

    const toInsert: any[] = [];
    const errors: { row: number; reason: string }[] = [];
    const seenPairs = new Set<string>();

    data.rows.forEach((r, i) => {
      const rowNum = i + 2; // header is row 1
      const emp = findEmpresa(r.empresa);
      if (!emp) return errors.push({ row: rowNum, reason: `Empresa no encontrada: "${r.empresa}"` });
      const sp = findSponsor(r.sponsor);
      if (!sp) return errors.push({ row: rowNum, reason: `Solución no encontrada: "${r.sponsor}"` });

      const dayDate = data.day_dates[r.dia - 1];
      if (!dayDate) return errors.push({ row: rowNum, reason: `Día ${r.dia} sin fecha asignada` });

      const timeMatch = String(r.hora).match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return errors.push({ row: rowNum, reason: `Hora inválida: "${r.hora}"` });
      const hhmm = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;

      const empResp = resolveResp(emp.id, emp.user_id, r.responsable_empresa ?? null);
      const spResp = resolveResp(sp.id, sp.user_id, null);
      if (!empResp) return errors.push({ row: rowNum, reason: `Sin responsable disponible para empresa "${r.empresa}"` });
      if (!spResp) return errors.push({ row: rowNum, reason: `Sin responsable disponible para solución "${r.sponsor}"` });

      const pairKey = `${empResp.id}::${spResp.id}`;
      if (seenPairs.has(pairKey)) {
        return errors.push({ row: rowNum, reason: `Reunión duplicada en el Excel (${r.empresa} × ${r.sponsor})` });
      }
      seenPairs.add(pairKey);

      const mesaStr = r.mesa === null || r.mesa === undefined || r.mesa === "" ? "" : String(r.mesa);
      const submesaStr = (r.submesa ?? "").toString().trim();
      const room = mesaStr ? `${mesaStr}${submesaStr}` : null;

      toInsert.push({
        event_id: data.event_id,
        empresa_user_id: empResp.id,
        sponsor_user_id: spResp.id,
        empresa_account_id: emp.id,
        sponsor_account_id: sp.id,
        scheduled_time: madridIso(dayDate, hhmm),
        room,
        duration_minutes: 15,
        status: "confirmed",
        assigned_by: context.userId,
        notes: r.notas?.trim() || null,
        slot: r.slot?.trim() || null,
        bloque: r.bloque?.trim() || null,
        tipo_sponsor: r.tipo_sponsor?.trim() || null,
        tipo_match: r.tipo_match?.trim() || null,
        empresa_responsable: { full_name: empResp.full_name ?? "", role: empResp.account_role ?? "", email: empResp.email ?? "" },
        sponsor_responsable: { full_name: spResp.full_name ?? "", role: spResp.account_role ?? "", email: spResp.email ?? "" },
      });
    });

    let imported = 0;
    const chunkSize = 100;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { data: ok, error } = await supabaseAdmin
        .from("meetings_1to1")
        .upsert(chunk, { onConflict: "empresa_user_id,sponsor_user_id,event_id" })
        .select("id");
      if (error) {
        // Fallback row-by-row so a single bad record doesn't kill the whole batch
        for (const row of chunk) {
          const { error: e2 } = await supabaseAdmin
            .from("meetings_1to1")
            .upsert(row, { onConflict: "empresa_user_id,sponsor_user_id,event_id" });
          if (e2) {
            errors.push({ row: 0, reason: `${(row.empresa_responsable as any)?.full_name ?? ""} × ${(row.sponsor_responsable as any)?.full_name ?? ""}: ${e2.message}` });
          } else {
            imported += 1;
          }
        }
      } else {
        imported += ok?.length ?? chunk.length;
      }
    }

    return { imported, total: data.rows.length, errors };
  });
