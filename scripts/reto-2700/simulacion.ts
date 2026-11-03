/**
 * Reto 2.700 · Fase 9 · Simulación y batería de pruebas de extremo a extremo.
 *
 * SOLO actúa sobre el evento oculto de pruebas (TEST_EVENT). Nunca escribe en
 * likes, matches, reuniones, agenda, perfiles reales ni en otros eventos.
 * Comprueba antes y después que los datos reales no han cambiado.
 *
 * Uso:  bun scripts/reto-2700/simulacion.ts            (prueba completa y deja el evento limpio)
 *       bun scripts/reto-2700/simulacion.ts --keep     (deja los datos de la simulación para verlos en la app)
 * Requiere SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY.
 */

const URL_ = process.env.SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const EV = "27000000-0000-4000-8000-000000002700";
const PASS = "RetoTest2700!";
const KEEP = process.argv.includes("--keep");
const OUT = process.env.RETO_SIM_OUT || "/tmp/reto-sim-result.json";

if (!URL_ || !SVC || !ANON) throw new Error("Faltan variables de entorno de Supabase");

// ---------- utilidades HTTP ----------
type Res = { status: number; data: any; text: string; ms: number };
async function http(path: string, key: string, token: string | null, init: RequestInit = {}, prefer?: string): Promise<Res> {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const t0 = performance.now();
  const r = await fetch(`${URL_}${path}`, { ...init, headers: { ...headers, ...(init.headers as any) } });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data, text, ms: performance.now() - t0 };
}
const svc = (p: string, init: RequestInit = {}, prefer = "return=representation") => http(`/rest/v1/${p}`, SVC, SVC, init, prefer);
const svcRpc = (fn: string, args: object) => http(`/rest/v1/rpc/${fn}`, SVC, SVC, { method: "POST", body: JSON.stringify(args) });
const as = (tok: string | null) => ({
  get: (p: string) => http(`/rest/v1/${p}`, ANON, tok),
  post: (p: string, body: object) => http(`/rest/v1/${p}`, ANON, tok, { method: "POST", body: JSON.stringify(body) }, "return=representation"),
  patch: (p: string, body: object) => http(`/rest/v1/${p}`, ANON, tok, { method: "PATCH", body: JSON.stringify(body) }, "return=representation"),
  del: (p: string) => http(`/rest/v1/${p}`, ANON, tok, { method: "DELETE" }, "return=representation"),
  rpc: (fn: string, args: object) => http(`/rest/v1/rpc/${fn}`, ANON, tok, { method: "POST", body: JSON.stringify(args) }),
});
async function count(table: string, filter = ""): Promise<number> {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1${filter ? "&" + filter : ""}`, {
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, Prefer: "count=exact", Range: "0-0" },
  });
  const cr = r.headers.get("content-range") || "*/0";
  return Number(cr.split("/")[1]);
}
async function svcAll(table: string, query: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
      headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, Range: `${from}-${from + 999}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error(`${table}: ${JSON.stringify(rows)}`);
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uidT = (i: number) => `27000000-0000-4000-8001-${String(i).padStart(12, "0")}`;
const UA = "27000000-0000-4000-8000-00000000000a";
const UB = "27000000-0000-4000-8000-00000000000b";
const UC = "27000000-0000-4000-8000-00000000000c";
const emailOf = (id: string) =>
  id === UA ? "reto.a@test.conectamos.invalid" : id === UB ? "reto.b@test.conectamos.invalid" : id === UC ? "reto.c@test.conectamos.invalid"
  : `reto.t${String(Number(id.slice(-12))).padStart(2, "0")}@test.conectamos.invalid`;

// ---------- registro de resultados ----------
type Check = { area: string; name: string; ok: boolean; detail: string };
const results: Check[] = [];
let area = "";
function check(name: string, ok: boolean, detail: unknown = "") {
  const d = typeof detail === "string" ? detail : JSON.stringify(detail);
  results.push({ area, name, ok, detail: d.slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"} [${area}] ${name}${d ? " — " + d.slice(0, 160) : ""}`);
}
const failed = (r: Res) => r.status >= 400;
const msg = (r: Res) => (r.data && (r.data.message || r.data.msg)) || r.text;

// ---------- sesiones ----------
const tokens = new Map<string, { access: string; refresh: string }>();
async function signIn(id: string) {
  if (tokens.has(id)) return tokens.get(id)!.access;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await http(`/auth/v1/token?grant_type=password`, ANON, null, { method: "POST", body: JSON.stringify({ email: emailOf(id), password: PASS }) });
    if (r.status === 200) { tokens.set(id, { access: r.data.access_token, refresh: r.data.refresh_token }); return r.data.access_token as string; }
    if (r.status === 429) { await sleep(15000); continue; }
    throw new Error(`No se pudo iniciar sesión como ${emailOf(id)}: ${r.status} ${r.text}`);
  }
  throw new Error("Límite de inicios de sesión alcanzado");
}

// ---------- seguridad: confirmar que es el evento de pruebas ----------
async function guardTestEvent() {
  const r = await svc(`events?id=eq.${EV}&select=id,title,status,is_active`, {}, "");
  const ev = r.data?.[0];
  if (!ev || !String(ev.title).startsWith("TEST") || ev.is_active) throw new Error(`El evento ${EV} no es el evento oculto de pruebas: ${r.text}`);
  const others = await svc(`reto_config?event_id=neq.${EV}&select=event_id`, {}, "");
  return { ev, otherRetoEvents: (others.data || []).length };
}

// ---------- foto de datos reales (no regresión) ----------
async function realSnapshot() {
  const realProfiles = "email=not.like.*%40test.conectamos.invalid";
  const meetings = await svcAll("meetings_1to1", "select=*&order=id");
  const events = await svcAll("events", `select=*&id=neq.${EV}&order=id`);
  return {
    likes: await count("likes"),
    matches: await count("matches"),
    meetings_1to1: meetings.length,
    meetings_hash: Bun.hash(JSON.stringify(meetings)).toString(),
    events_hash: Bun.hash(JSON.stringify(events)).toString(),
    event_agenda: await count("event_agenda"),
    profiles_reales: await count("profiles", realProfiles),
    empresa_profiles: await count("empresa_profiles"),
    sponsor_profiles: await count("sponsor_profiles"),
    reto_other_events: await count("reto_marks", `event_id=neq.${EV}`),
  };
}

// ---------- preparación: 120 personas ficticias ----------
async function ensure120() {
  for (let i = 57; i <= 117; i++) {
    const id = uidT(i);
    const ptype = i % 3 === 0 ? "sponsor" : "drh";
    const comp = `Empresa TEST ${String.fromCharCode(65 + ((i - 57) % 15))}3`;
    const name = `Test ${i} (TEST)`;
    const exists = await http(`/auth/v1/admin/users/${id}`, SVC, SVC);
    if (exists.status !== 200) {
      const c = await http(`/auth/v1/admin/users`, SVC, SVC, { method: "POST", body: JSON.stringify({
        id, email: emailOf(id), password: PASS, email_confirm: true,
        user_metadata: { full_name: name, role: ptype === "sponsor" ? "sponsor" : "empresa", company_name: comp },
      }) });
      if (c.status !== 200) throw new Error(`Alta ${i}: ${c.text}`);
    }
    // Que no aparezcan en el directorio real de empresas/soluciones
    await svc(`empresa_profiles?user_id=eq.${id}`, { method: "DELETE" });
    await svc(`sponsor_profiles?user_id=eq.${id}`, { method: "DELETE" });
    await svc(`reto_participants?on_conflict=event_id,user_id`, { method: "POST", body: JSON.stringify({
      event_id: EV, user_id: id, participant_type: ptype, display_name: name, cargo: "Cargo TEST", company_name: comp,
    }) }, "resolution=ignore-duplicates,return=minimal");
  }
}

async function resetEvent() {
  for (const t of ["reto_marks", "reto_intro_claims", "reto_mission_awards", "reto_points_log", "reto_introductions", "reto_seen", "reto_snapshot_pairs", "reto_snapshots"]) {
    const r = await svc(`${t}?event_id=eq.${EV}`, { method: "DELETE" }, "return=minimal");
    if (failed(r)) throw new Error(`Reset ${t}: ${r.text}`);
  }
  await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({
    is_active: true, emergency_off: false, is_closed: false, closes_at: null, closed_at: null, closed_by: null,
    superconector_user_id: null, alma_user_id: null, awards_note: null, awards_at: null,
  }) });
  await svc(`reto_missions?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ starts_at: null, enabled: true, status: "active" }) });
  await svcRpc("reto_recalc_event_internal", { _event: EV });
}

async function participants(): Promise<{ user_id: string; participant_type: string; company_name: string | null }[]> {
  return svcAll("reto_participants", `select=user_id,participant_type,company_name&event_id=eq.${EV}&order=user_id`);
}
async function addMarks(rows: [string, string][]) {
  for (let i = 0; i < rows.length; i += 150) {
    const batch = rows.slice(i, i + 150).map(([f, t]) => ({ event_id: EV, from_user_id: f, to_user_id: t }));
    const r = await svc(`reto_marks?on_conflict=event_id,from_user_id,to_user_id`, { method: "POST", body: JSON.stringify(batch) }, "resolution=ignore-duplicates,return=minimal");
    if (failed(r)) throw new Error(`Marcas: ${r.text}`);
  }
}
function localPairs(marks: { from_user_id: string; to_user_id: string }[], members: Set<string>) {
  const set = new Set(marks.map((m) => `${m.from_user_id}|${m.to_user_id}`));
  const conn = new Map<string, number>();
  let pairs = 0;
  for (const m of marks) {
    if (m.from_user_id < m.to_user_id && set.has(`${m.to_user_id}|${m.from_user_id}`) && members.has(m.from_user_id) && members.has(m.to_user_id)) {
      pairs++;
      conn.set(m.from_user_id, (conn.get(m.from_user_id) || 0) + 1);
      conn.set(m.to_user_id, (conn.get(m.to_user_id) || 0) + 1);
    }
  }
  return { pairs, conn };
}
const connCount = async (tok: string) => Number((await as(tok).rpc("reto_connection_count", { _event: EV })).data);
async function scoreOf(tok: string, user: string) {
  const r = await as(tok).rpc("reto_scoreboard", { _event: EV });
  return (r.data as any[]).find((x) => x.user_id === user);
}

// =====================================================================
async function main() {
  const t0 = Date.now();
  area = "Preparación";
  const g = await guardTestEvent();
  check("El evento es el oculto de pruebas y está en borrador", true, `${g.ev.title} · ${g.ev.status}`);
  check("Ningún evento real tiene el Reto activado", g.otherRetoEvents === 0, `${g.otherRetoEvents} eventos reales con Reto`);
  await ensure120();
  const before = await realSnapshot();
  await resetEvent();
  const all = await participants();
  check("Hay 120 participantes ficticios en el evento de pruebas", all.length === 120, `${all.length} participantes`);
  const realEvent = (await svc(`events?id=neq.${EV}&select=id&limit=1`, {}, "")).data?.[0]?.id;

  const A = await signIn(UA), B = await signIn(UB), C = await signIn(UC);
  const T = async (i: number) => signIn(uidT(i));
  const NON = uidT(117); // persona que retiramos para probar «no participante»

  // ---------------------------------------------------------------- 1
  area = "1 · Acceso y aislamiento";
  {
    const anon = as(null);
    const r1 = await anon.get(`reto_participants?event_id=eq.${EV}&select=user_id`);
    check("Sin sesión no se ve el álbum", failed(r1) || (r1.data as any[]).length === 0, `${r1.status}`);
    const r2 = await anon.rpc("reto_connection_count", { _event: EV });
    check("Sin sesión no se puede leer el contador", failed(r2), `${r2.status}`);

    await svc(`reto_participants?event_id=eq.${EV}&user_id=eq.${NON}`, { method: "DELETE" });
    const X = await signIn(NON);
    const r3 = await as(X).get(`reto_participants?event_id=eq.${EV}&select=user_id`);
    check("Quien no participa no ve el álbum", (r3.data as any[]).length === 0, `${(r3.data as any[]).length} filas`);
    const r4 = await as(X).post("reto_marks", { event_id: EV, from_user_id: NON, to_user_id: UA });
    check("Quien no participa no puede marcar conexiones", failed(r4), msg(r4));
    const r5 = await as(X).rpc("reto_scoreboard", { _event: EV });
    check("Quien no participa no ve el ranking", (r5.data as any[]).length === 0, `${(r5.data as any[]).length} filas`);

    const r6 = await as(A).post("reto_marks", { event_id: EV, from_user_id: UB, to_user_id: UC });
    check("Nadie puede marcar en nombre de otra persona", failed(r6), msg(r6));
    await addMarks([[uidT(1), uidT(2)]]);
    const r7 = await as(A).get(`reto_marks?event_id=eq.${EV}&select=from_user_id,to_user_id`);
    check("Cada persona solo ve sus propias marcas", (r7.data as any[]).every((m) => m.from_user_id === UA || m.to_user_id === UA), `${(r7.data as any[]).length} visibles`);
    await svc(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${uidT(1)}&to_user_id=eq.${uidT(2)}`, { method: "DELETE" });

    if (realEvent) {
      const r8 = await as(A).post("reto_marks", { event_id: realEvent, from_user_id: UA, to_user_id: UB });
      check("No se pueden crear marcas en un evento real", failed(r8), msg(r8));
    }
    for (const [fn, args] of [
      ["reto_admin_summary", { _event: EV }], ["reto_admin_close", { _event: EV }], ["reto_admin_reopen", { _event: EV }],
      ["reto_admin_add_participants", { _event: EV, _users: [NON] }], ["reto_admin_remove_participants", { _event: EV, _users: [UB] }],
      ["reto_admin_set_winners", { _event: EV, _super: UA, _alma: UB, _note: "x" }], ["reto_live_scores", { _event: EV }],
      ["reto_close_internal", { _event: EV, _by: UA }], ["reto_recalc_event_internal", { _event: EV }],
    ] as const) {
      const r = await as(A).rpc(fn, args);
      check(`Un participante no puede usar ${fn}`, failed(r), msg(r));
    }
    const r9 = await as(A).patch(`reto_config?event_id=eq.${EV}`, { emergency_off: true });
    const cfg = (await svc(`reto_config?event_id=eq.${EV}&select=emergency_off`, {}, "")).data[0];
    check("Un participante no puede cambiar la configuración", !cfg.emergency_off, `${r9.status}, filas cambiadas: ${(r9.data || []).length}`);
    const r10 = await as(A).post("reto_icebreakers", { event_id: EV, position: 99, question: "hack" });
    check("Un participante no puede editar los comodines", failed(r10), msg(r10));
    const r11 = await as(A).post("reto_mission_awards", { event_id: EV, mission_id: "00000000-0000-0000-0000-000000000000", user_id: UA, award_index: 1, points: 999 });
    check("Un participante no puede darse puntos", failed(r11), msg(r11));
  }

  // ---------------------------------------------------------------- 2
  area = "2 · Reciprocidad";
  {
    const c0 = await connCount(A);
    await as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: UB });
    check("A marca a B → no cuenta todavía (0)", (await connCount(A)) === c0 && (await scoreOf(A, UA)).connections === 0);
    await as(B).post("reto_marks", { event_id: EV, from_user_id: UB, to_user_id: UA });
    const c1 = await connCount(A);
    check("B marca a A → cuenta 1 conexión", c1 === c0 + 1 && (await scoreOf(B, UB)).connections === 1, `contador ${c1}`);
    const d = await as(A).del(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UA}&to_user_id=eq.${UB}`);
    check("A desmarca → vuelve a 0", (d.data || []).length === 1 && (await connCount(A)) === c0 && (await scoreOf(B, UB)).connections === 0);
    const d2 = await as(B).del(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UA}&to_user_id=eq.${UB}`);
    check("B no puede borrar la marca de A", (d2.data || []).length === 0);
    await as(B).del(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UB}&to_user_id=eq.${UA}`);
  }

  // ---------------------------------------------------------------- 3
  area = "3 · Simultaneidad y duplicados";
  {
    const res = await Promise.all(Array.from({ length: 15 }, () => as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: UC })));
    const n = await count("reto_marks", `event_id=eq.${EV}&from_user_id=eq.${UA}&to_user_id=eq.${UC}`);
    check("15 pulsaciones simultáneas → 1 sola marca", n === 1, `${res.filter((r) => r.status === 201).length} aceptadas, ${n} guardadas`);
    const c0 = await connCount(A);
    await Promise.all([as(C).post("reto_marks", { event_id: EV, from_user_id: UC, to_user_id: UA }), as(C).post("reto_marks", { event_id: EV, from_user_id: UC, to_user_id: UA })]);
    check("Marcas cruzadas simultáneas → la pareja cuenta 1 vez", (await connCount(A)) === c0 + 1);
    const t1 = await T(1);
    await Promise.all([as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: uidT(1) }), as(t1).post("reto_marks", { event_id: EV, from_user_id: uidT(1), to_user_id: UA })]);
    check("A y otra persona se marcan a la vez → 1 conexión nueva", (await connCount(A)) === c0 + 2);
    const self = await as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: UA });
    check("Nadie puede conectarse consigo mismo", failed(self), msg(self));
  }

  area = "4 · Puntuación";
  {
    // A tiene 2 conexiones (C y Test 01). La 3.ª desbloquea «Rompe el hielo» (+10); perderla lo retira.
    const rh = (await svc(`reto_missions?event_id=eq.${EV}&code=eq.rompe_hielo&select=id,threshold,bonus_points`, {}, "")).data[0];
    const s0 = await scoreOf(A, UA);
    await addMarks([[UA, uidT(6)], [uidT(6), UA]]);
    const s1 = await scoreOf(A, UA);
    check("Al llegar a 3 conexiones se concede «Rompe el hielo»", s0.connections === 2 && s1.connections === 3 && s1.bonus === s0.bonus + rh.bonus_points, `bonus ${s0.bonus}→${s1.bonus}`);
    await svc(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${uidT(6)}&to_user_id=eq.${UA}`, { method: "DELETE" });
    const s2 = await scoreOf(A, UA);
    const rev = await count("reto_points_log", `event_id=eq.${EV}&user_id=eq.${UA}&reason=eq.revoke`);
    check("Al bajar del umbral se retira el bonus y queda registrado", s2.connections === 2 && s2.bonus === s0.bonus && rev > 0, `bonus ${s1.bonus}→${s2.bonus}, ${rev} retirada(s) en el registro`);
    await addMarks([[uidT(6), UA]]);
    check("Al recuperar la conexión vuelve el bonus", (await scoreOf(A, UA)).bonus === s1.bonus);
  }

  // ---------------------------------------------------------------- 5 (antes de la carga, con parejas limpias)
  area = "5 · ¡Te presento!";
  const I = await T(2), P3 = await T(3), P4 = await T(4);
  {
    const intro = (tok: string, p1: string, p2: string) => as(tok).rpc("reto_create_introduction", { _event: EV, _p1: p1, _p2: p2 });
    const r1 = await intro(I, uidT(3), uidT(4));
    const r2 = await intro(I, uidT(5), uidT(6));
    const r3 = await intro(I, uidT(7), uidT(8));
    check("Se pueden crear 3 presentaciones", !failed(r1) && !failed(r2) && !failed(r3), [r1.status, r2.status, r3.status].join(","));
    const r4 = await intro(I, uidT(9), uidT(10));
    check("La 4.ª presentación se bloquea", failed(r4) && /máximo/i.test(msg(r4)), msg(r4));
    const r5 = await intro(I, UA, UC); // A y C ya están conectados (prueba 3)
    check("No se puede presentar a una pareja ya conectada", failed(r5) && /ya están conectadas/i.test(msg(r5)), msg(r5));
    const r6 = await intro(A, uidT(3), uidT(4));
    check("Otra persona no puede presentar a la misma pareja", failed(r6) && /ya ha presentado/i.test(msg(r6)), msg(r6));
    const r7 = await intro(I, uidT(2), uidT(11));
    check("Nadie puede presentarse a sí mismo", failed(r7), msg(r7));
    const id = r1.data as string;
    await as(P3).rpc("reto_respond_introduction", { _id: id, _action: "confirm" });
    await as(P4).rpc("reto_respond_introduction", { _id: id, _action: "confirm" });
    const pre = await as(I).rpc("reto_my_introductions", { _event: EV });
    const row = (pre.data as any[]).find((x) => x.id === id);
    check("Confirmada por los dos pero sin conectar → sigue pendiente", row?.status === "pending" && !row.awarded, row?.status);
    await as(P3).post("reto_marks", { event_id: EV, from_user_id: uidT(3), to_user_id: uidT(4) });
    await as(P4).post("reto_marks", { event_id: EV, from_user_id: uidT(4), to_user_id: uidT(3) });
    const post = await as(I).rpc("reto_my_introductions", { _event: EV });
    const row2 = (post.data as any[]).find((x) => x.id === id);
    const sc = await scoreOf(I, uidT(2));
    check("Confirmada + conectada → validada y +40 puntos", row2?.status === "validated" && row2.awarded && sc.bonus >= 40, `${row2?.status}, bonus ${sc.bonus}`);
    const can = await as(I).rpc("reto_cancel_introduction", { _id: id });
    check("Una presentación validada no se puede cancelar", failed(can), msg(can));
    const outsider = await as(A).rpc("reto_respond_introduction", { _id: r2.data, _action: "confirm" });
    check("Solo las personas presentadas pueden confirmar", failed(outsider), msg(outsider));
    // Retirar la conexión quita los puntos; volver a conectar los devuelve
    await as(P3).del(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${uidT(3)}&to_user_id=eq.${uidT(4)}`);
    const lost = await scoreOf(I, uidT(2));
    check("Si la pareja se desconecta, se retiran los 40 puntos", lost.bonus === sc.bonus - 40, `bonus ${lost.bonus}`);
    await as(P3).post("reto_marks", { event_id: EV, from_user_id: uidT(3), to_user_id: uidT(4) });
    check("Al reconectar, vuelven los 40 puntos", (await scoreOf(I, uidT(2))).bonus === sc.bonus);
  }

  // ---------------------------------------------------------------- 6
  area = "6 · Horarios y activación";
  {
    const tp = (await svc(`reto_missions?event_id=eq.${EV}&code=eq.te_presento&select=id`, {}, "")).data[0].id;
    await svc(`reto_missions?id=eq.${tp}`, { method: "PATCH", body: JSON.stringify({ starts_at: new Date(Date.now() + 3600e3).toISOString() }) });
    const r = await as(A).rpc("reto_create_introduction", { _event: EV, _p1: uidT(20), _p2: uidT(21) });
    check("Una misión programada no funciona antes de su hora", failed(r) && /aún no ha empezado/i.test(msg(r)), msg(r));
    await svc(`reto_missions?id=eq.${tp}`, { method: "PATCH", body: JSON.stringify({ starts_at: null }) });
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ closes_at: "2026-11-27T18:00:00+01:00" }) });
    const cfg = (await svc(`reto_config?event_id=eq.${EV}&select=closes_at`, {}, "")).data[0];
    check("La hora de Madrid se guarda bien (18:00 Madrid = 17:00 UTC en noviembre)", new Date(cfg.closes_at).toISOString() === "2026-11-27T17:00:00.000Z", cfg.closes_at);
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ closes_at: null }) });
    const ma = await as(A).rpc("reto_admin_mission_action", { _id: tp, _action: "pause" });
    check("Un participante no puede activar/pausar misiones", failed(ma), msg(ma));
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ emergency_off: true }) });
    const off = await as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: uidT(30) });
    const pop = await as(A).rpc("reto_entry_popup", { _event: EV });
    check("Apagado de emergencia: no se puede marcar ni salen avisos", failed(off) && pop.data === null, msg(off));
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ is_active: false, emergency_off: false }) });
    const inactive = await as(A).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: uidT(30) });
    check("Reto desactivado: no se puede marcar", failed(inactive), msg(inactive));
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ is_active: true }) });
  }

  // ---------------------------------------------------------------- 7a
  area = "7 · Avisos (pop-ups)";
  {
    await svc(`reto_seen?event_id=eq.${EV}&user_id=eq.${UA}`, { method: "DELETE" });
    const p1 = await as(A).rpc("reto_entry_popup", { _event: EV });
    check("Al entrar sale el aviso de misión", p1.data?.kind === "mission", JSON.stringify(p1.data)?.slice(0, 80));
    await as(A).rpc("reto_dismiss_popup", { _event: EV, _kind: "mission" });
    const p2 = await as(A).rpc("reto_entry_popup", { _event: EV });
    const p3 = await as(A).rpc("reto_entry_popup", { _event: EV });
    check("Una vez cerrado, no vuelve a salir", p2.data?.kind !== "mission" && p3.data?.kind !== "mission", JSON.stringify(p2.data));
  }

  // ---------------------------------------------------------------- 8
  area = "8 · Comodines «Rompe el hielo»";
  {
    const before8 = await scoreOf(A, UA);
    const logs0 = await count("reto_points_log", `event_id=eq.${EV}`);
    const q = await as(A).get(`reto_icebreakers?event_id=eq.${EV}&select=position,question`);
    check("Los participantes pueden leer los comodines", !failed(q), `${(q.data as any[]).length} preguntas guardadas (si 0, la app usa las 27 por defecto)`);
    const after8 = await scoreOf(A, UA);
    check("Usar comodines no da puntos ni deja registro", before8.points === after8.points && logs0 === (await count("reto_points_log", `event_id=eq.${EV}`)));
  }

  // ---------------------------------------------------------------- 15 carga
  area = "15 · Carga con 120 personas";
  let rng = 2700;
  const rand = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
  {
    const ids = all.map((p) => p.user_id).filter((id) => id !== NON);
    const rows: [string, string][] = [];
    const seen = new Set<string>();
    while (rows.length < 2000) {
      const a = ids[Math.floor(rand() * ids.length)], b = ids[Math.floor(rand() * ids.length)];
      if (a === b || seen.has(a + b)) continue;
      seen.add(a + b); rows.push([a, b]);
      if (rand() < 0.8 && !seen.has(b + a)) { seen.add(b + a); rows.push([b, a]); }
    }
    const tl = performance.now();
    await addMarks(rows);
    check("Se registran ~2.000 marcas entre 119 personas", true, `${rows.length} marcas en ${Math.round((performance.now() - tl) / 1000)} s`);
    // 40 consultas simultáneas del ranking (como 40 móviles abriendo a la vez)
    const toks = [A, B, C, I, P3, P4];
    const ts = performance.now();
    const res = await Promise.all(Array.from({ length: 40 }, (_, k) => as(toks[k % toks.length]).rpc("reto_scoreboard", { _event: EV })));
    const worst = Math.max(...res.map((r) => r.ms));
    check("40 consultas simultáneas del ranking responden bien", res.every((r) => r.status === 200), `peor ${Math.round(worst)} ms, total ${Math.round(performance.now() - ts)} ms`);
  }

  // ---------------------------------------------------------------- 4 puntuación
  area = "4 · Puntuación";
  const members = () => participants().then((p) => new Set(p.map((x) => x.user_id)));
  {
    const marks = await svcAll("reto_marks", `select=from_user_id,to_user_id&event_id=eq.${EV}`);
    const mem = await members();
    const { pairs, conn } = localPairs(marks, mem);
    check("El contador colectivo coincide con el cálculo independiente", (await connCount(A)) === pairs, `${pairs} conexiones`);
    const awards = await svcAll("reto_mission_awards", `select=user_id,points,mission_id&event_id=eq.${EV}`);
    const bonus = new Map<string, number>();
    for (const a of awards) bonus.set(a.user_id, (bonus.get(a.user_id) || 0) + a.points);
    const sb = (await as(A).rpc("reto_scoreboard", { _event: EV })).data as any[];
    const bad = sb.filter((r) => r.connections !== (conn.get(r.user_id) || 0) || r.bonus !== (bonus.get(r.user_id) || 0) || r.points !== r.connections + r.bonus);
    check("Conexiones y puntos de las 119 personas son correctos", bad.length === 0 && sb.length === mem.size, `${sb.length} filas, ${bad.length} discrepancias`);
    const ms = (await svc(`reto_missions?event_id=eq.${EV}&select=id,code,threshold`, {}, "")).data as any[];
    const rh = ms.find((m) => m.code === "rompe_hielo"), c27 = ms.find((m) => m.code === "club_27");
    const has = (u: string, mid: string) => awards.some((a) => a.user_id === u && a.mission_id === mid);
    const wrong = sb.filter((r) => (r.connections >= rh.threshold) !== has(r.user_id, rh.id) || (r.connections >= c27.threshold) !== has(r.user_id, c27.id));
    check("Misiones por número de conexiones se conceden solo al llegar al umbral", wrong.length === 0, `${wrong.length} errores`);
    const total = await connCount(A);
    // Aviso de hito colectivo
    if (total >= 900) {
      await svc(`reto_seen?event_id=eq.${EV}&user_id=eq.${UB}`, { method: "DELETE" });
      await as(B).rpc("reto_dismiss_popup", { _event: EV, _kind: "mission" });
      const h1 = await as(B).rpc("reto_entry_popup", { _event: EV });
      await as(B).rpc("reto_dismiss_popup", { _event: EV, _kind: "milestone" });
      const h2 = await as(B).rpc("reto_entry_popup", { _event: EV });
      area = "7 · Avisos (pop-ups)";
      check("El hito colectivo (900) avisa una sola vez", h1.data?.kind === "milestone" && h2.data === null, `${JSON.stringify(h1.data)} → ${JSON.stringify(h2.data)}`);
    }
  }

  // ---------------------------------------------------------------- 10
  area = "10 · Altas y bajas";
  {
    const victim = uidT(5);
    const V = await T(5);
    const mem = await members();
    const marks = await svcAll("reto_marks", `select=from_user_id,to_user_id&event_id=eq.${EV}`);
    const vconn = localPairs(marks, mem).conn.get(victim) || 0;
    const c0 = await connCount(A);
    const row = (await svc(`reto_participants?event_id=eq.${EV}&user_id=eq.${victim}&select=*`, {}, "")).data[0];
    await svc(`reto_participants?event_id=eq.${EV}&user_id=eq.${victim}`, { method: "DELETE" });
    check("Al dar de baja, sus conexiones dejan de contar", (await connCount(A)) === c0 - vconn, `${c0} → ${c0 - vconn}`);
    check("Sus marcas se conservan (por si vuelve)", (await count("reto_marks", `event_id=eq.${EV}&from_user_id=eq.${victim}`)) > 0);
    const r = await as(V).post("reto_marks", { event_id: EV, from_user_id: victim, to_user_id: UA });
    check("Una persona dada de baja no puede marcar", failed(r), msg(r));
    await svc(`reto_participants`, { method: "POST", body: JSON.stringify(row) });
    await svcRpc("reto_recalc_event_internal", { _event: EV });
    check("Al volver a darla de alta, se recuperan sus conexiones", (await connCount(A)) === c0);
  }

  // ---------------------------------------------------------------- 11
  area = "11 · Persistencia";
  {
    const mine = await as(A).get(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UA}&select=to_user_id&order=to_user_id`);
    const ref = await http(`/auth/v1/token?grant_type=refresh_token`, ANON, null, { method: "POST", body: JSON.stringify({ refresh_token: tokens.get(UA)!.refresh }) });
    const A2 = ref.data.access_token;
    const again = await as(A2).get(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UA}&select=to_user_id&order=to_user_id`);
    check("Tras recargar/renovar la sesión, todo sigue igual", ref.status === 200 && JSON.stringify(mine.data) === JSON.stringify(again.data), `${(again.data as any[]).length} marcas`);
    tokens.set(UA, { access: A2, refresh: ref.data.refresh_token });
  }

  // ---------------------------------------------------------------- 12
  area = "12 · Errores y reintentos";
  {
    const A_ = tokens.get(UA)!.access;
    const tgt = uidT(40);
    await as(A_).del(`reto_marks?event_id=eq.${EV}&from_user_id=eq.${UA}&to_user_id=eq.${tgt}`);
    const ac = new AbortController();
    const p = fetch(`${URL_}/rest/v1/reto_marks`, { method: "POST", signal: ac.signal, headers: { apikey: ANON, Authorization: `Bearer ${A_}`, "Content-Type": "application/json" }, body: JSON.stringify({ event_id: EV, from_user_id: UA, to_user_id: tgt }) }).catch(() => "cortada");
    ac.abort();
    await p;
    const retry = await as(A_).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: tgt });
    const retry2 = await as(A_).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: tgt });
    const n = await count("reto_marks", `event_id=eq.${EV}&from_user_id=eq.${UA}&to_user_id=eq.${tgt}`);
    check("Conexión cortada + reintento → 1 sola marca", n === 1, `reintentos ${retry.status}/${retry2.status}`);
    check("Un duplicado devuelve un aviso controlado (no rompe nada)", retry2.status === 409 || retry.status === 409, `${retry2.status} ${retry2.data?.code ?? ""}`);
    const bad = await as(A_).rpc("reto_scoreboard", { _event: "no-es-un-id" });
    const ok = await as(A_).rpc("reto_scoreboard", { _event: EV });
    check("Tras una petición errónea, la siguiente funciona", failed(bad) && ok.status === 200);
  }

  // ---------------------------------------------------------------- 9
  area = "9 · Cierre manual y automático";
  {
    const A_ = tokens.get(UA)!.access;
    const live = await connCount(A_);
    const liveSb = ((await as(A_).rpc("reto_scoreboard", { _event: EV })).data as any[]).sort((x, y) => x.user_id.localeCompare(y.user_id));
    const closes = await Promise.all(Array.from({ length: 6 }, () => svcRpc("reto_close_internal", { _event: EV, _by: null })));
    const trues = closes.filter((r) => r.data === true).length;
    check("6 cierres simultáneos → se cierra exactamente 1 vez", trues === 1, closes.map((r) => String(r.data)).join(","));
    const again = await svcRpc("reto_close_internal", { _event: EV, _by: null });
    check("Cerrar otra vez no repite ni cambia nada", again.data === false);
    const snapRows = await count("reto_snapshots", `event_id=eq.${EV}`);
    check("La instantánea guarda a todas las personas", snapRows === liveSb.length, `${snapRows} filas`);
    const frozenSb = ((await as(A_).rpc("reto_scoreboard", { _event: EV })).data as any[]).sort((x, y) => x.user_id.localeCompare(y.user_id));
    check("El ranking cerrado es idéntico al del momento del cierre", JSON.stringify(frozenSb.map((r) => [r.user_id, r.connections, r.points])) === JSON.stringify(liveSb.map((r) => [r.user_id, r.connections, r.points])));
    const m = await as(A_).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: uidT(50) });
    check("Con el Reto cerrado no se puede marcar", failed(m), msg(m));
    await addMarks([[uidT(60), uidT(61)], [uidT(61), uidT(60)]]); // forzado por detrás
    check("Aunque entren datos por detrás, el contador cerrado no cambia", (await connCount(A_)) === live, `${live}`);
    const snap = await svcAll("reto_snapshots", `select=user_id,connections,points,rank_connections,rank_points&event_id=eq.${EV}`);
    const tieOk = snap.every((r) => snap.filter((s) => s.connections === r.connections).every((s) => s.rank_connections === r.rank_connections))
      && snap.every((r) => r.rank_connections === 1 + snap.filter((s) => s.connections > r.connections).length);
    check("Empates en el ranking reciben la misma posición", tieOk);
    const top = Math.max(...snap.map((s) => s.connections));
    const leaders = snap.filter((s) => s.connections === top);
    check("Desempate visible: se detecta si hay empate en el 1.er puesto", true, `${leaders.length} persona(s) con ${top} conexiones`);
    const w = await as(A_).rpc("reto_admin_set_winners", { _event: EV, _super: leaders[0].user_id, _alma: null, _note: null });
    check("Un participante no puede registrar ganadores", failed(w), msg(w));
    await svc(`reto_marks?event_id=eq.${EV}&from_user_id=in.(${uidT(60)},${uidT(61)})&to_user_id=in.(${uidT(60)},${uidT(61)})`, { method: "DELETE" });
    // Reabrir (plan de reversión) y probar el cierre automático por hora
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ is_closed: false, closed_at: null, closes_at: new Date(Date.now() - 5000).toISOString() }) });
    await svcRpc("reto_recalc_event_internal", { _event: EV });
    const late = await as(A_).post("reto_marks", { event_id: EV, from_user_id: UA, to_user_id: uidT(51) });
    check("Pasada la hora de cierre ya no se puede marcar", failed(late), msg(late));
    const f1 = await as(A_).rpc("reto_finalize_if_due", { _event: EV });
    const f2 = await as(B).rpc("reto_finalize_if_due", { _event: EV });
    const cfg = (await svc(`reto_config?event_id=eq.${EV}&select=is_closed,closed_at`, {}, "")).data[0];
    check("Cierre automático: el primero que entra lo congela, solo una vez", f1.data === true && f2.data === false && cfg.is_closed, `${f1.data}/${f2.data}`);
    await svc(`reto_config?event_id=eq.${EV}`, { method: "PATCH", body: JSON.stringify({ is_closed: false, closed_at: null, closes_at: null }) });
  }

  // ---------------------------------------------------------------- 14
  area = "14 · No regresión";
  if (!KEEP) await resetEvent();
  await svc(`reto_participants?on_conflict=event_id,user_id`, { method: "POST", body: JSON.stringify({ event_id: EV, user_id: NON, participant_type: 117 % 3 === 0 ? "sponsor" : "drh", display_name: "Test 117 (TEST)", cargo: "Cargo TEST", company_name: "Empresa TEST O3" }) }, "resolution=ignore-duplicates,return=minimal");
  const after = await realSnapshot();
  for (const k of Object.keys(before) as (keyof typeof before)[]) {
    check(`Datos reales sin cambios: ${k}`, before[k] === after[k], `${before[k]} → ${after[k]}`);
  }
  check("El evento de pruebas queda con 120 participantes", (await count("reto_participants", `event_id=eq.${EV}`)) === 120);
  if (!KEEP) check("El evento de pruebas queda limpio para las pruebas del equipo", (await count("reto_marks", `event_id=eq.${EV}`)) === 0);

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} comprobaciones superadas en ${Math.round((Date.now() - t0) / 1000)} s`);
  await Bun.write(OUT, JSON.stringify({ at: new Date().toISOString(), pass, total: results.length, results }, null, 2));
  if (pass !== results.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error("ERROR", e);
  await Bun.write(OUT, JSON.stringify({ error: String(e), results }, null, 2));
  process.exitCode = 2;
});
