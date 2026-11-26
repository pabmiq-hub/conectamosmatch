import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "./admin-shared.server";
import { fetchAll, getEventScope } from "./event-scope.server";
import { buildMeetingParticipants } from "./meeting-participants";
import { overlapsTalk } from "./talk-attendance";

export const listMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ event_id: z.string().uuid().optional().nullable() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("meetings_1to1").select("*").order("scheduled_time", { ascending: true, nullsFirst: false });
    if (data.event_id) q = q.eq("event_id", data.event_id);
    const { data: meetings, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    // Build account_id -> company_name maps via owners
    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      fetchAll((f, t) => supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name").range(f, t)).then((data) => ({ data })),
      fetchAll((f, t) => supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name").range(f, t)).then((data) => ({ data })),
      fetchAll((f, t) => supabaseAdmin.from("profiles").select("id, account_id").range(f, t)).then((data) => ({ data })),
    ]);
    const real = (n: any) => (n && n !== "Mi Empresa" ? n : null);
    const empById = new Map((emps ?? []).map((e: any) => [e.id, real(e.company_name)]));
    const spById = new Map((sps ?? []).map((s: any) => [s.id, real(s.company_name)]));
    const profAcc = new Map((profs ?? []).map((p: any) => [p.id, p.account_id]));
    const empAccName = new Map<string, string>();
    (emps ?? []).forEach((e: any) => { const a = profAcc.get(e.user_id); if (a && real(e.company_name)) empAccName.set(a, e.company_name); });
    const spAccName = new Map<string, string>();
    (sps ?? []).forEach((s: any) => { const a = profAcc.get(s.user_id); if (a && real(s.company_name)) spAccName.set(a, s.company_name); });
    const empOwnerName = new Map((emps ?? []).map((e: any) => [e.user_id, e.company_name]));
    const spOwnerName = new Map((sps ?? []).map((s: any) => [s.user_id, s.company_name]));

    return {
      meetings: (meetings ?? []).map((m: any) => {
        const eAcc = m.empresa_account_id ?? profAcc.get(m.empresa_user_id);
        const sAcc = m.sponsor_account_id ?? profAcc.get(m.sponsor_user_id);
        return {
          ...m,
          empresa_name: (eAcc && (empById.get(eAcc) ?? empAccName.get(eAcc))) || real(empOwnerName.get(m.empresa_user_id)) || "—",
          sponsor_name: (sAcc && (spById.get(sAcc) ?? spAccName.get(sAcc))) || real(spOwnerName.get(m.sponsor_user_id)) || "—",
        };
      }),
    };
  });

export const autoAssignSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("meetings_1to1").delete().eq("id", data.id);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const clearMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      rescue_from_talks: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let rescues: { talk_id: string; person_name: string; company_name: string }[] = [];
    // Resolve account ids for both sides so dashboards can filter by account
    const { data: pr } = await supabaseAdmin
      .from("profiles")
      .select("id, account_id")
      .in("id", [data.empresa_user_id, data.sponsor_user_id]);
    const accMap = new Map((pr ?? []).map((p: any) => [p.id, p.account_id]));

    if (data.scheduled_time && data.event_id) {
      const iso = new Date(data.scheduled_time).toISOString();
      const { readEventTalks, profileTalkEntries } = await import("./talk-attendance.server");
      const talks = await readEventTalks(supabaseAdmin, data.event_id);
      const entries = (await Promise.all([data.empresa_user_id, data.sponsor_user_id].map((id) => profileTalkEntries(supabaseAdmin, talks, id)))).flat();
      const conflicts = entries.filter((e) => overlapsTalk(iso, data.duration_minutes ?? 15, e.talk));
      if (conflicts.length && !data.rescue_from_talks) throw new Error(`${conflicts[0]!.person.name} está en ${conflicts[0]!.talk.id}. Confirma el rescate para moverla a la reunión.`);
      rescues = conflicts.map((c) => ({ talk_id: c.talk.id, person_name: c.person.name, company_name: c.person.empresa }));
      const { data: clash } = await supabaseAdmin.from("meetings_1to1")
        .select("empresa_user_id, sponsor_account_id, room")
        .eq("event_id", data.event_id).eq("scheduled_time", iso).neq("status", "cancelled");
      const spAcc = accMap.get(data.sponsor_user_id);
      for (const c of clash ?? []) {
        if (c.empresa_user_id === data.empresa_user_id) throw new Response("La persona de la empresa ya tiene una reunión a esa hora", { status: 409 });
        if (spAcc && c.sponsor_account_id === spAcc) throw new Response("La solución ya tiene una reunión a esa hora", { status: 409 });
        if (data.room && c.room && c.room.trim().toLowerCase() === data.room.trim().toLowerCase()) throw new Response("Esa mesa ya está ocupada a esa hora", { status: 409 });
      }
    }

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
    if (rescues.length && data.event_id) {
      const { error: exErr } = await supabaseAdmin.from("event_talk_exclusions").upsert(
        rescues.map((r) => ({ ...r, event_id: data.event_id!, removed_by: context.userId })),
        { onConflict: "event_id,talk_id,person_name,company_name", ignoreDuplicates: true });
      if (exErr) {
        await supabaseAdmin.from("meetings_1to1").delete().eq("id", m.id);
        throw new Error("No se ha podido sacar a la persona del Talk; la reunión no se ha creado");
      }
    }
    return { meeting: m, rescued: rescues };
  });

export const listAllParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ context, data: input }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = input.event_id ? await getEventScope(supabaseAdmin, input.event_id) : null;
    const [empresas, sponsors, members] = await Promise.all([
      fetchAll((from, to) => supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name").order("id").range(from, to)),
      fetchAll((from, to) => supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name").order("id").range(from, to)),
      fetchAll((from, to) => supabaseAdmin.from("profiles").select("id, account_id, full_name, email, account_role, is_active").order("id").range(from, to)),
    ]);
    return {
      empresas: buildMeetingParticipants(empresas, members, scope?.accountIds),
      sponsors: buildMeetingParticipants(sponsors, members, scope?.accountIds),
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
  // Compute Europe/Madrid UTC offset (in minutes) at the given local wall-clock time.
  // We can't trust short timezone names ("CET"/"CEST") across runtimes — Workers/V8
  // sometimes returns "GMT+2" which broke the previous CEST detection and shifted
  // every imported meeting 1 hour back during DST.
  const probe = new Date(`${dateStr}T${timeStr}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(probe);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const asUtc = Date.UTC(
    Number(get("year")), Number(get("month")) - 1, Number(get("day")),
    Number(get("hour")) % 24, Number(get("minute")), Number(get("second")),
  );
  const offsetMin = Math.round((asUtc - probe.getTime()) / 60000); // +120 in CEST, +60 in CET
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return new Date(`${dateStr}T${timeStr}:00${sign}${oh}:${om}`).toISOString();
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: emps }, { data: sps }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("empresa_profiles").select("id, user_id, company_name"),
      supabaseAdmin.from("sponsor_profiles").select("id, user_id, company_name"),
      supabaseAdmin.from("profiles").select("id, account_id, full_name, email, account_role, role, is_active"),
    ]);

    // Only accounts registered for this event can get meetings in it
    const scope = await getEventScope(supabaseAdmin, data.event_id);
    const findEmpresaAll = buildNameIndex(emps ?? []);
    const findSponsorAll = buildNameIndex(sps ?? []);
    const findEmpresa = buildNameIndex((emps ?? []).filter((e: any) => scope.accountIds.has(e.id)));
    const findSponsor = buildNameIndex((sps ?? []).filter((s: any) => scope.accountIds.has(s.id)));

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
      if (!emp) return errors.push({ row: rowNum, reason: findEmpresaAll(r.empresa) ? `Empresa no inscrita en este evento: "${r.empresa}"` : `Empresa no encontrada: "${r.empresa}"` });
      const sp = findSponsor(r.sponsor);
      if (!sp) return errors.push({ row: rowNum, reason: findSponsorAll(r.sponsor) ? `Solución no inscrita en este evento: "${r.sponsor}"` : `Solución no encontrada: "${r.sponsor}"` });

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

// =====================================================================
// ============ Generador de propuestas (borrador) =====================
// =====================================================================

function madridParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${String(Number(g("hour")) % 24).padStart(2, "0")}:${g("minute")}` };
}
const addMin = (t: string, n: number) => { const [h, m] = t.split(":").map(Number); const x = h * 60 + m + n; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

export const generateMeetingProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateProposal } = await import("./meeting-generator");
    const { data: ev, error: evErr } = await supabaseAdmin.from("events").select("*").eq("id", data.event_id).single();
    if (evErr || !ev) throw new Error("Evento no encontrado");
    const e: any = ev;
    const slotMinutes: number = e.slot_duration_minutes ?? 15;
    const windows = (Array.isArray(e.meeting_windows) ? e.meeting_windows : []) as any[];

    const [{ data: matches }, { data: meetings }, { data: avail }, { data: sponsors }, { data: empresas }] = await Promise.all([
      supabaseAdmin.from("matches").select("id, empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id").eq("event_id", data.event_id).eq("status", "mutual"),
      supabaseAdmin.from("meetings_1to1").select("empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id, scheduled_time, duration_minutes, room, status").eq("event_id", data.event_id),
      supabaseAdmin.from("attendee_availability").select("user_id, event_date, attends, blocked_ranges, max_meetings").eq("event_id", data.event_id),
      supabaseAdmin.from("sponsor_profiles").select("id, company_name, sponsorship_level"),
      supabaseAdmin.from("empresa_profiles").select("id, company_name"),
    ]);

    const levels = (e.sponsor_meetings_by_level ?? {}) as Record<string, number>;
    const accountCap: Record<string, number> = {};
    const accountName: Record<string, string> = {};
    for (const s of sponsors ?? []) {
      accountName[s.id] = s.company_name;
      const lv = String(s.sponsorship_level ?? "").toUpperCase();
      accountCap[s.id] = levels[lv] ?? e.sponsor_default_max_meetings ?? 8;
    }
    for (const em of empresas ?? []) { accountName[em.id] = em.company_name; accountCap[em.id] = e.empresa_max_meetings ?? 8; }

    const active = (meetings ?? []).filter((m: any) => m.status !== "cancelled");
    const pairHasMeeting = new Set(active.map((m: any) => `${m.empresa_account_id}|${m.sponsor_account_id}`));
    const existing: any[] = [];
    for (const m of active) {
      if (!m.scheduled_time) continue;
      const p = madridParts(m.scheduled_time);
      const end = addMin(p.time, m.duration_minutes ?? slotMinutes);
      for (const u of [m.empresa_user_id, m.sponsor_user_id]) {
        if (!u) continue;
        existing.push({ user_id: u, date: p.date, start: p.time, end, room: u === m.empresa_user_id ? m.room : null, empresa_account_id: m.empresa_account_id, sponsor_account_id: m.sponsor_account_id });
      }
    }

    const seenPairs = new Set<string>();
    const evScope = await getEventScope(supabaseAdmin, data.event_id);
    const matchInputs = (matches ?? [])
      .filter((m: any) => m.empresa_user_id && m.sponsor_user_id && m.empresa_account_id && m.sponsor_account_id)
      // Only accounts registered for this event
      .filter((m: any) => evScope.accountIds.has(m.empresa_account_id) && evScope.accountIds.has(m.sponsor_account_id))
      .filter((m: any) => {
        const k = `${m.empresa_account_id}|${m.sponsor_account_id}`;
        if (pairHasMeeting.has(k) || seenPairs.has(k)) return false;
        seenPairs.add(k); return true;
      })
      .map((m: any) => ({ match_id: m.id, empresa_user_id: m.empresa_user_id, sponsor_user_id: m.sponsor_user_id, empresa_account_id: m.empresa_account_id, sponsor_account_id: m.sponsor_account_id }));

    const availability: Record<string, any> = {};
    for (const a of avail ?? []) {
      availability[`${a.user_id}|${a.event_date}`] = { attends: a.attends, blocked: (a.blocked_ranges as any[]) ?? [], max: a.max_meetings };
    }

    const result = generateProposal({ windows, slotMinutes, rooms: (e.rooms ?? []).length ? e.rooms : ["Mesa 1"], matches: matchInputs, availability, accountCap, existing });

    const userIds = Array.from(new Set(matchInputs.flatMap((m) => [m.empresa_user_id, m.sponsor_user_id])));
    const userName: Record<string, string> = {};
    for (let i = 0; i < userIds.length; i += 200) {
      const { data: pr } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds.slice(i, i + 200));
      for (const p of pr ?? []) userName[p.id] = p.full_name || p.email || "";
    }
    return {
      ...result,
      accountName, userName,
      stats: { windows: windows.length, slotMinutes, rooms: (e.rooms ?? []).length, pending: matchInputs.length },
    };
  });

export const approveMeetingProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    event_id: z.string().uuid(),
    proposals: z.array(z.object({
      match_id: z.string().uuid().nullable(),
      empresa_user_id: z.string().uuid(), sponsor_user_id: z.string().uuid(),
      empresa_account_id: z.string().uuid(), sponsor_account_id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
      room: z.string().max(100), label: z.string().max(80).optional().nullable(),
    })).min(1).max(2000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin.from("events").select("slot_duration_minutes").eq("id", data.event_id).single();
    const ids = Array.from(new Set(data.proposals.flatMap((p) => [p.empresa_user_id, p.sponsor_user_id])));
    const { data: pr } = await supabaseAdmin.from("profiles").select("id, full_name, email, account_role").in("id", ids);
    const pm = new Map((pr ?? []).map((p: any) => [p.id, p]));
    const resp = (id: string) => { const p: any = pm.get(id); return p ? { full_name: p.full_name ?? "", role: p.account_role ?? "", email: p.email ?? "" } : null; };
    const rows = data.proposals.map((p) => ({
      event_id: data.event_id, match_id: p.match_id,
      empresa_user_id: p.empresa_user_id, sponsor_user_id: p.sponsor_user_id,
      empresa_account_id: p.empresa_account_id, sponsor_account_id: p.sponsor_account_id,
      scheduled_time: madridIso(p.date, p.start), duration_minutes: ev?.slot_duration_minutes ?? 15,
      room: p.room, bloque: p.label || null, tipo_match: "Match mutuo", status: "confirmed" as const,
      assigned_by: context.userId, empresa_responsable: resp(p.empresa_user_id), sponsor_responsable: resp(p.sponsor_user_id),
    }));
    let created = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const { data: ok, error } = await supabaseAdmin.from("meetings_1to1").insert(rows.slice(i, i + 100)).select("id");
      if (error) throw new Error(`Se crearon ${created}; error: ${error.message}`);
      created += ok?.length ?? 0;
    }
    return { created };
  });

export const setMeetingsPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid(), published: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({ meetings_published: data.published, meetings_published_at: data.published ? new Date().toISOString() : null })
      .eq("id", data.event_id);
    if (error) throw new Error(error.message);
    let notified = 0;
    if (data.published) {
      const { data: ms } = await supabaseAdmin
        .from("meetings_1to1")
        .select("empresa_user_id, sponsor_user_id, status, scheduled_time")
        .eq("event_id", data.event_id);
      const emp = new Set<string>(); const sp = new Set<string>();
      for (const m of ms ?? []) {
        if (m.status === "cancelled" || !m.scheduled_time) continue;
        if (m.empresa_user_id) emp.add(m.empresa_user_id);
        if (m.sponsor_user_id) sp.add(m.sponsor_user_id);
      }
      const rows = [
        ...[...emp].map((u) => ({ user_id: u, type: "meetings_published", title: "Tus reuniones 1to1 ya están publicadas", body: "Consulta tu agenda de reuniones", link: "/empresa/reuniones-1to1" })),
        ...[...sp].map((u) => ({ user_id: u, type: "meetings_published", title: "Tus reuniones 1to1 ya están publicadas", body: "Consulta tu agenda de reuniones", link: "/sponsor/reuniones-1to1" })),
      ];
      for (let i = 0; i < rows.length; i += 200) await supabaseAdmin.from("notifications").insert(rows.slice(i, i + 200));
      notified = rows.length;
    }
    return { ok: true, notified };
  });

// ------------------------------------------------------------------
// Slot availability for the manual "Crear reunión" modal
// ------------------------------------------------------------------
export const getMeetingSlotAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      event_id: z.string().uuid(),
      empresa_account_id: z.string().uuid().nullable().optional(),
      sponsor_account_id: z.string().uuid().nullable().optional(),
      empresa_user_id: z.string().uuid().nullable().optional(),
      sponsor_user_id: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await fetchAll((from, to) =>
      supabaseAdmin.from("meetings_1to1")
        .select("id, scheduled_time, room, empresa_account_id, sponsor_account_id, empresa_user_id, status")
        .eq("event_id", data.event_id).not("scheduled_time", "is", null).neq("status", "cancelled")
        .order("id").range(from, to));
    const times = Array.from(new Set(rows.map((r: any) => new Date(r.scheduled_time).toISOString()))).sort();
    // Sponsor's usual tables, most used first
    const roomCount = new Map<string, number>();
    for (const r of rows as any[]) if (r.sponsor_account_id === data.sponsor_account_id && r.room) roomCount.set(r.room, (roomCount.get(r.room) ?? 0) + 1);
    const sponsorRooms = [...roomCount.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    // The panel and manual creation use the same durable Talk exclusions.
    const { readEventTalks, profileTalkEntries } = await import("./talk-attendance.server");
    const talks = await readEventTalks(supabaseAdmin, data.event_id);
    const entries = (await Promise.all([data.empresa_user_id, data.sponsor_user_id]
      .filter((id): id is string => !!id)
      .map((id) => profileTalkEntries(supabaseAdmin, talks, id)))).flat();
    const slots = times.map((iso) => {
      const at = rows.filter((r: any) => new Date(r.scheduled_time).toISOString() === iso) as any[];
      const reasons: string[] = [];
      if (data.empresa_account_id && at.some((r) => r.empresa_account_id === data.empresa_account_id && (!data.empresa_user_id || r.empresa_user_id === data.empresa_user_id))) reasons.push("Empresa ocupada");
      if (data.sponsor_account_id && at.some((r) => r.sponsor_account_id === data.sponsor_account_id)) reasons.push("Solución ocupada");
      // Talk conflicts are rescuable: creating the meeting moves the person out of the Talk.
      const talk_conflicts = entries.filter((e) => overlapsTalk(iso, 15, e.talk)).map((e) => ({ person: e.person.name, talk: e.talk.id, start: e.talk.start, end: e.talk.end }));
      const used = new Set(at.map((r) => r.room).filter(Boolean));
      const room = sponsorRooms.find((r) => !used.has(r)) ?? null;
      return { iso, free: reasons.length === 0, reasons, talk_conflicts, suggested_room: room };
    });
    return { slots };
  });

// Occupancy per slot for the whole event (lets the admin pick one side + slot first)
export const getEventSlotOccupancy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ event_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await fetchAll((from, to) =>
      supabaseAdmin.from("meetings_1to1")
        .select("id, scheduled_time, empresa_account_id, sponsor_account_id")
        .eq("event_id", data.event_id).not("scheduled_time", "is", null).neq("status", "cancelled")
        .order("id").range(from, to));
    const map = new Map<string, { empresas: Set<string>; sponsors: Set<string> }>();
    for (const r of rows as any[]) {
      const iso = new Date(r.scheduled_time).toISOString();
      const e = map.get(iso) ?? { empresas: new Set(), sponsors: new Set() };
      if (r.empresa_account_id) e.empresas.add(r.empresa_account_id);
      if (r.sponsor_account_id) e.sponsors.add(r.sponsor_account_id);
      map.set(iso, e);
    }
    return { slots: [...map.keys()].sort().map((iso) => ({ iso, empresas: [...map.get(iso)!.empresas], sponsors: [...map.get(iso)!.sponsors] })) };
  });
