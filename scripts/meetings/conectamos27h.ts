/**
 * Genera el borrador de reuniones 1to1 de «Conectamos 27h» según la Guía técnica v20,
 * usando el planificador puro src/lib/guided-meeting-planner.ts.
 * Uso: bun scripts/meetings/conectamos27h.ts            (simulación + informe, no escribe)
 *      bun scripts/meetings/conectamos27h.ts --apply    (reemplaza reuniones del evento; quedan en borrador)
 * Para otro evento: copiar este archivo y cambiar la sección CONFIG.
 */
import { planMeetings, reserveTalks, type PSlot, type Unit, type Sponsor } from "../../src/lib/guided-meeting-planner";
import * as XLSX from "xlsx";

// ======================= CONFIG =======================
const EVENT = "b07b2f16-fb8a-4ae6-b655-a62606c2dde3";
const THU = "2026-11-26", FRI = "2026-11-27";
const SLOT_TIMES: [string, string[], [string, string][]][] = [
  [THU, ["18:15", "18:30", "18:45", "19:00", "19:15", "19:30"], [["18:15", "19:45"]]],
  [FRI, ["10:50", "11:05", "11:20", "11:35", "11:50", "12:05", "12:20", "12:35"], [["10:50", "12:20"]]],
];
// v19: 20 DRH reservados durante los 45 min completos de cada Talk (sustituye "25 libres por slot")
const TALK_MIN = 20;
const TALKS = [
  { id: "Talk A", slotIds: ["18:15", "18:30", "18:45"].map((t) => `${THU} ${t}`) },
  { id: "Talk B", slotIds: ["19:00", "19:15", "19:30"].map((t) => `${THU} ${t}`) },
  { id: "Talk C", slotIds: ["10:50", "11:05", "11:20"].map((t) => `${FRI} ${t}`) },
  { id: "Talk D", slotIds: ["11:35", "11:50", "12:05"].map((t) => `${FRI} ${t}`) },
];
const GUARANTEE: Record<string, [number, Sponsor["tier"]?, number?]> = {
  "tti success insights": [11], "talentia": [10], "payfit": [10], "learning heroes": [10], "fermi casado": [11],
  "marlex": [10], "happydonia": [20, "GOLD"], "job": [20, "GOLD"], "adp": [20, "GOLD"], "coaching": [20, "GOLD"],
  "vidext": [24, "PREMIUM"], "cloud": [20, "GOLD"], "tamigo": [14, "PREMIUM"], "vip district": [14, "PREMIUM"],
  "leeters": [20, "GOLD"], "clasing": [14, "PREMIUM"], "foxize": [15, "PREMIUM"], "hastee": [15, "PREMIUM"],
  "talentware": [15, "PREMIUM"], "wavveup": [10, undefined, 15], "beambassador": [10, undefined, 14],
  "genera": [10], "kombo": [11],
};
const THU_ONLY = ["Albert Sala", "Bárbara Alós", "Imma Xampeny", "Mireia Marimon", "Sandra Dorado", "África Villar", "Laia Parellada", "Pilar Insua"];
// v21: Daba Nespresso solo viernes 27 (llegada del 26 incierta)
const FRI_FULL = ["Carlos Carriedo"];
const ONLY_SPONSORS: Record<string, string[]> = { "Carlos Carriedo": ["job", "adp", "vidext"] };
// v21: mesas por solución y soluciones solo con match mutuo
const TABLES: Record<string, number> = { marlex: 2, vidext: 3 };
const MUTUAL_ONLY = ["vidext"];
const FRI_ONLY = ["Carolina Maniuc", "Alexi Choucha", "Ramón Amorós"];
const THU_ONLY_EXACT6 = ["Andrea Varela", "Sonia Arceredillo"];
// v20: Silvia Bueso-Inchausti fuera del matching automático (solo alta manual si confirma)
const PENDING = ["Miquel Martí", "Jethro Cortés", "Nines Espejo", "Silvia Bueso"];
const EXCLUDED_COMPANIES = ["relats"];
const VETOES: Record<string, string[]> = { "Miguel Núñez": ["adp", "payfit", "talentia"] };
const MIN4 = ["Arantxa Martínez", "Àurea Benito"];
const JOINT = ["Bárbara Alós", "África Villar"];
const DISJOINT = { group: "easyjet", names: ["Laia Parellada", "Alexi Choucha"], max: 4 };
const FIXED = [{ name: "Ramón Amorós", sponsor: "leeters", slot: `${FRI} 10:50` }];
// v15+: Leeters viernes slot 1 privado (Ramón), slot 2 individual, slots 3–8 dobles
const LEETERS_GROUP_SLOTS = ["11:20", "11:35", "11:50", "12:05", "12:20", "12:35"].map((t) => `${FRI} ${t}`);
const WAVVEUEP_THU_TABLES = 2;
const SPONSOR_VETO_COMPANIES: Record<string, string[]> = { leeters: ["bain", "casa del libro"] };
// v18: preferencias en orden (subordinadas a garantías, vetos y unicidad por empresa)
const PRIORITIES: Record<string, string[]> = {
  clasing: ["isdin", "kantar", "bosch", "fribin", "werfoods", "arabella", "zest", "lacer", "universidad de navarra", "cognita", "taurus", "endesa", "bain", "humaneva"],
  hastee: ["endesa", "linde", "optica universitaria", "samu", "cognita", "dkv", "atletico", "fcc", "domusvi", "torraspapel", "antolin", "kantar", "europastry"],
  "tti success insights": ["fribin", "paraguas", "menarini", "mattel", "atresmedia", "isdin", "werfoods", "garmin", "bain", "neural", "zest"],
};
const REOPT_TARGET = 6;
const GOLD_MAX_DRH = 8; // v21: DRH que eligen Gold deficitarias pueden llegar a 7-8
// ======================================================

const APPLY = process.argv.includes("--apply");
const URL_ = process.env.SUPABASE_URL!, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function get(path: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
    const d = await r.json(); out.push(...d); if (d.length < 1000) break;
  }
  return out;
}
const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const nameIs = (full: string, short: string) => { const f = norm(full), t = norm(short).split(" "); return t.every((w) => f.split(" ").includes(w)); };

const regs = (await get(`event_registrations?event_id=eq.${EVENT}&select=user_id,role_at_event,status,attendee_company`)).filter((r) => r.status !== "cancelled" && r.user_id);
const uids = [...new Set(regs.map((r) => r.user_id))];
const profs: any[] = [];
for (let i = 0; i < uids.length; i += 100) profs.push(...await get(`profiles?id=in.(${uids.slice(i, i + 100).join(",")})&select=id,full_name,email,account_id,role,is_active`));
const [emps, sps, likes] = await Promise.all([
  get("empresa_profiles?select=id,company_name"), get("sponsor_profiles?select=id,company_name,sponsorship_level"),
  get(`likes?event_id=eq.${EVENT}&select=from_user_id,to_user_id`),
]);
const empName = new Map(emps.map((e) => [e.id, e.company_name])), spRow = new Map(sps.map((s) => [s.id, s]));
const allAcc = new Map<string, string>(); // user -> account (all profiles of likes)
const likeUsers = [...new Set(likes.flatMap((l) => [l.from_user_id, l.to_user_id]))];
for (let i = 0; i < likeUsers.length; i += 100) for (const p of await get(`profiles?id=in.(${likeUsers.slice(i, i + 100).join(",")})&select=id,account_id`)) if (p.account_id) allAcc.set(p.id, p.account_id);

const people = profs.filter((p) => p.account_id && p.is_active !== false);
const drh = people.filter((p) => empName.has(p.account_id) && !EXCLUDED_COMPANIES.some((x) => norm(empName.get(p.account_id)).includes(x)));
const reps = people.filter((p) => spRow.has(p.account_id));
const findDrh = (n: string) => drh.find((p) => nameIs(p.full_name, n));
const warnings: string[] = [];

// Selecciones por cuenta
const sel = new Map<string, Set<string>>(), back = new Map<string, Set<string>>();
for (const l of likes) {
  const a = allAcc.get(l.from_user_id), b = allAcc.get(l.to_user_id); if (!a || !b) continue;
  if (empName.has(a) && spRow.has(b)) { if (!sel.has(a)) sel.set(a, new Set()); sel.get(a)!.add(b); }
  if (spRow.has(a) && empName.has(b)) { if (!back.has(b)) back.set(b, new Set()); back.get(b)!.add(a); }
}

// Slots
const slots: PSlot[] = [];
for (const [date, times, talks] of SLOT_TIMES) for (const t of times) {
  const [h, m] = t.split(":").map(Number); const e = h! * 60 + m! + 15;
  const end = `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
  slots.push({ id: `${date} ${t}`, date, start: t, end, talk: talks.some(([a, b]) => t >= a && t < b) });
}
const daySlots = (d: string) => slots.filter((s) => s.date === d).map((s) => s.id);
const both = slots.map((s) => s.id);

// Sponsors
const sponsors: Sponsor[] = [];
for (const s of sps) {
  const myReps = reps.filter((r) => r.account_id === s.id); if (!myReps.length) continue;
  const key = Object.keys(GUARANTEE).find((k) => norm(s.company_name).includes(k));
  if (!key) { warnings.push(`Solución sin garantía en la guía: ${s.company_name}`); continue; }
  const [g, tierG, promo] = GUARANTEE[key]!;
  const lvl = String(s.sponsorship_level ?? "").toUpperCase();
  const tier = (tierG ?? (["PLATINUM", "GOLD", "PREMIUM", "STARTUP"].includes(lvl) ? lvl : "BASIC")) as Sponsor["tier"];
  const cap = { PLATINUM: 4, GOLD: 3, PREMIUM: 2, BASIC: 1, STARTUP: 1 }[tier];
  const isW = key === "wavveup", isL = key === "leeters";
  sponsors.push({
    accountId: s.id, name: s.company_name, tier, guarantee: g, promoTarget: promo,
    tableCap: isL ? 1 : isW ? Math.max(cap, WAVVEUEP_THU_TABLES) : TABLES[key] ?? cap,
    reps: myReps.map((r, i) => ({ userId: r.id, slots: isW && i > 0 ? daySlots(THU) : both })),
    groupSlots: isL ? LEETERS_GROUP_SLOTS : undefined,
    priorityAccounts: (PRIORITIES[key] ?? []).map((k) => { const hit = emps.find((e) => norm(e.company_name).includes(k)); if (!hit) warnings.push(`Prioridad de ${s.company_name} no encontrada: ${k}`); return hit?.id; }).filter((x): x is string => !!x),
    vetoAccounts: (SPONSOR_VETO_COMPANIES[key] ?? []).flatMap((k) => emps.filter((e) => norm(e.company_name).includes(k)).map((e) => e.id)),
  });
}
const spKey = (k: string) => sponsors.find((s) => norm(s.name).includes(k))?.accountId;
for (const k of Object.keys(GUARANTEE)) if (!spKey(k)) warnings.push(`Solución de la guía no encontrada en el evento: ${k}`);
const spIds = new Set(sponsors.map((s) => s.accountId));

// Unidades DRH
const units: Unit[] = [];
const used = new Set<string>();
const mutualOnlyIds = new Set(MUTUAL_ONLY.map((k) => spKey(k)).filter(Boolean));
const accSel = (acc: string) => [...(sel.get(acc) ?? [])].filter((x) => spIds.has(x) && (!mutualOnlyIds.has(x) || back.get(acc)?.has(x)));
const accMut = (acc: string) => accSel(acc).filter((x) => back.get(acc)?.has(x));
const jointPeople = JOINT.map(findDrh);
if (jointPeople.every(Boolean)) {
  const acc = jointPeople[0]!.account_id;
  units.push({ id: jointPeople.map((p) => p!.id).join("+"), members: jointPeople.map((p) => p!.id), accountId: acc, name: JOINT.join(" + "), slots: daySlots(THU), selections: accSel(acc), mutual: accMut(acc), maxMeetings: 6, exactSlots: true });
  jointPeople.forEach((p) => used.add(p!.id));
} else warnings.push("No se encontraron Bárbara Alós y/o África Villar");
let thuAlt = 1;
// easyJet: reparte selecciones de la cuenta, mismo grupo sin repetir sponsor
for (const p of drh) {
  if (used.has(p.id)) continue;
  const n = p.full_name ?? "";
  const is = (l: string[]) => l.some((x) => nameIs(n, x));
  if (is(PENDING)) { warnings.push(`Pendiente/baja, sin reuniones: ${n}`); continue; }
  const acc = p.account_id;
  let av = both, max = 8, exact = false;
  // v19: un solo día con 4 citas → 4 slots consecutivos al inicio o al final (viernes: final, deja Talk C completo)
  if (is(THU_ONLY)) { const d = daySlots(THU); av = (thuAlt++ % 2 === 0) ? d.slice(0, 4) : d.slice(-4); max = 4; }
  if (is(FRI_ONLY)) { av = nameIs(n, "Ramón Amorós") ? daySlots(FRI) : daySlots(FRI).slice(-4); max = 4; }
  if (is(FRI_FULL)) { av = daySlots(FRI); max = 3; }
  if (is(THU_ONLY_EXACT6)) { av = daySlots(THU); max = 6; exact = true; }
  const onlyKey = Object.keys(ONLY_SPONSORS).find((k) => nameIs(n, k));
  const onlyIds = onlyKey ? ONLY_SPONSORS[onlyKey]!.map(spKey) : null;
  const s = accSel(acc).filter((x) => !onlyIds || onlyIds.includes(x));
  if (s.length <= 6 && s.length > max) max = Math.min(s.length, av.length);
  const isDis = is(DISJOINT.names);
  if (isDis) max = DISJOINT.max;
  const vetoKey = Object.keys(VETOES).find((k) => nameIs(n, k));
  units.push({
    id: p.id, members: [p.id], accountId: acc, name: n, slots: av, selections: s, mutual: accMut(acc).filter((x) => !onlyIds || onlyIds.includes(x)), maxMeetings: max, exactSlots: exact,
    vetoes: vetoKey ? VETOES[vetoKey]!.map(spKey).filter((x): x is string => !!x) : undefined,
    minMeetings: is(MIN4) || isDis ? 4 : undefined, disjointGroup: isDis ? DISJOINT.group : undefined,
  });
}
// Avisar de personas del listado de la guía que no aparecen
for (const n of [...THU_ONLY, ...FRI_ONLY, ...THU_ONLY_EXACT6, ...MIN4, ...Object.keys(VETOES)]) if (!findDrh(n)) warnings.push(`Persona de la guía no encontrada entre las inscritas: ${n}`);
const fixed = FIXED.map((f) => ({ unitId: findDrh(f.name)?.id ?? "?", sponsorId: spKey(f.sponsor) ?? "?", slotId: f.slot }));

const twoDay = (u: Unit) => u.slots.length === slots.length;
const tr = reserveTalks(units, TALKS, TALK_MIN, twoDay);
const talkOf = new Map<string, string[]>();
for (const [t, us] of tr.reserved) for (const u of us) talkOf.set(u, [...(talkOf.get(u) ?? []), t]);
const r = planMeetings({ slots, units: tr.units, sponsors, fixed, minFreeOnTalk: 0, reoptTarget: REOPT_TARGET });
r.issues.unshift(...tr.issues);
for (const t of TALKS) { const us = tr.reserved.get(t.id) ?? []; const clash = us.filter((u) => r.assignments.some((a) => a.unitId === u && t.slotIds.includes(a.slotId))); console.log(`${t.id}: ${us.length} DRH reservados, solapes=${clash.length}`); if (clash.length) throw new Error(`${t.id} con solapes`); }

// ---------- Informe ----------
const uName = new Map(units.map((u) => [u.id, u.name])), sName = new Map(sponsors.map((s) => [s.accountId, s.name]));
const pName = new Map(profs.map((p) => [p.id, p.full_name]));
console.log(`DRH unidades: ${units.length} · Soluciones: ${sponsors.length} · Sesiones: ${r.sessions.length} · Asignaciones: ${r.assignments.length}`);
console.log("\nAVISOS:"); warnings.forEach((w) => console.log(" -", w));
console.log("\nSOLUCIONES (garantía / participaciones / déficit):");
for (const s of r.sponsorReport) console.log(` ${s.name.padEnd(32)} ${s.tier.padEnd(8)} G=${s.guarantee} M=${s.mutualMatches} U=${s.unilateralSelections} A=${s.participations} ses=${s.sessions} extraDRH=${s.protectionExtras} promo=${s.promoExtras} D=${s.deficit}`);
console.log("\nSLOTS:"); r.slotReport.forEach((s) => console.log(` ${s.slotId} talk=${s.talk} presentes=${s.present} ocupados=${s.occupied} libres=${s.free}`));
console.log(`\nINCIDENCIAS (${r.issues.length}):`); r.issues.forEach((i) => console.log(` - ${uName.get(i.unitId ?? "") ?? ""} ${sName.get(i.sponsorId ?? "") ?? ""}: ${i.reason}`));
const total = r.sponsorReport.reduce((t, s) => t + s.participations, 0), def = r.sponsorReport.reduce((t, s) => t + s.deficit, 0);
console.log(`\nTOTAL participaciones DRH: ${total} · Déficit total sobre garantías: ${def}`);

const KIND_LABEL: Record<string, string> = { FIJA: "Cita fija", SELECCION_DRH: "Garantía (selección DRH)", GARANTIA: "Garantía", EXTRA_PROTECCION_DRH: "EXTRA — PROTECCIÓN DRH", MINIMO_DRH: "Mínimo DRH", EXTRA_PROMOCIONAL: "EXTRA — PROMOCIONAL", REOPTIMIZACION: "Reoptimización 5→6" };
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.assignments.map((a) => {
  const sess = r.sessions.find((s) => s.id === a.sessionId)!;
  return { Día: a.slotId.slice(0, 10), Hora: a.slotId.slice(11), Empresa: empName.get(units.find((u) => u.id === a.unitId)!.accountId), DRH: uName.get(a.unitId), Solución: sName.get(a.sponsorId), Representante: pName.get(sess.repUserId), Mesa: `${sName.get(a.sponsorId)} ${sess.table}`, Sesión: sess.units.length > 1 || a.unitId.includes("+") ? "Grupal" : "Individual", "Tipo match": a.mutual ? "Match mutuo" : "Selección DRH", Tipo: KIND_LABEL[a.kind] };
}).sort((x, y) => (x.Día + x.Hora + x.Solución).localeCompare(y.Día + y.Hora + y.Solución))), "Reuniones");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.sponsorReport.map((s) => ({ Solución: s.name, Categoría: s.tier, Garantía: s.guarantee, "Matches mutuos": s.mutualMatches, "Selecciones unilaterales DRH": s.unilateralSelections, Sesiones: s.sessions, "Participaciones DRH": s.participations, "Extras protección DRH": s.protectionExtras, "Extras promocionales": s.promoExtras, Déficit: s.deficit }))), "Por solución");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units.map((u) => ({ DRH: u.name, Empresa: empName.get(u.accountId), Días: u.slots.length === 14 ? "26 y 27" : u.slots[0]?.startsWith(THU) ? "Solo 26" : u.slots.length ? "Solo 27" : "-", Selecciones: u.selections.length, "Matches mutuos": u.mutual.length, Asignadas: r.unitCount[u.id] ?? 0, Talks: (talkOf.get(u.id) ?? []).join(", "), "Seleccionadas pendientes": u.selections.length <= 6 ? u.selections.filter((s) => !r.assignments.some((a) => a.unitId === u.id && a.sponsorId === s)).map((s) => sName.get(s)).join(", ") : "" }))), "Por DRH");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(TALKS.flatMap((t) => (tr.reserved.get(t.id) ?? []).map((u) => ({ Talk: t.id, Inicio: t.slotIds[0], DRH: uName.get(u), Empresa: empName.get(units.find((x) => x.id === u)!.accountId) })))), "Talks reservados");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.slotReport.map((s) => ({ Slot: s.slotId, Talk: s.talk ? "Sí" : "No", Presentes: s.present, Ocupados: s.occupied, Libres: s.free }))), "Por slot");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...warnings.map((w) => ({ Tipo: "Aviso", Detalle: w })), ...r.issues.map((i) => ({ Tipo: "Incidencia", Detalle: `${uName.get(i.unitId ?? "") ?? ""} ${sName.get(i.sponsorId ?? "") ?? ""}: ${i.reason}` }))]), "Incidencias");
const dup = new Map<string, number>();
for (const a of r.assignments) { const k = `${units.find((u) => u.id === a.unitId)!.accountId}|${a.sponsorId}`; dup.set(k, (dup.get(k) ?? 0) + 1); }
const dupRows = [...dup].filter(([, n]) => n > 1).map(([k, n]) => ({ Empresa: empName.get(k.split("|")[0]!), Solución: sName.get(k.split("|")[1]!), Veces: n }));
console.log(`Duplicados empresa–solución: ${dupRows.length}`);
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dupRows.length ? dupRows : [{ Resultado: "0 duplicados empresa–solución (Consum cuenta como 1 sesión conjunta)" }]), "Auditoría exclusividad");
const out = process.env.OUT ?? "/tmp/conectamos27h-reuniones.xlsx";
XLSX.writeFile(wb, out); console.log("Informe:", out);

if (APPLY) {
  const ev = (await get(`events?id=eq.${EVENT}&select=meetings_published`))[0];
  if (ev?.meetings_published) throw new Error("Las reuniones del evento están publicadas: pásalas a borrador antes de regenerar.");
  const resp = (id: string) => { const p = profs.find((x) => x.id === id); return { full_name: p?.full_name ?? "", role: "", email: p?.email ?? "" }; };
  const madrid = (d: string, t: string) => new Date(`${d}T${t}:00+01:00`).toISOString();
  const rows = r.assignments.flatMap((a) => {
    const u = units.find((x) => x.id === a.unitId)!, sess = r.sessions.find((s) => s.id === a.sessionId)!, slot = slots.find((s) => s.id === a.slotId)!;
    const group = sess.units.length > 1 || u.members.length > 1;
    return u.members.map((m) => ({
      event_id: EVENT, empresa_user_id: m, sponsor_user_id: sess.repUserId, empresa_account_id: u.accountId, sponsor_account_id: a.sponsorId,
      scheduled_time: madrid(slot.date, slot.start), duration_minutes: 15, room: `${sName.get(a.sponsorId)} · Mesa ${sess.table}`,
      slot: slot.start, bloque: slot.date === THU ? "18:15–19:45" : "10:50–12:50", tipo_sponsor: sponsors.find((s) => s.accountId === a.sponsorId)!.tier,
      tipo_match: a.mutual ? "Match mutuo" : "Selección DRH", status: "confirmed",
      notes: [KIND_LABEL[a.kind], group ? `Sesión grupal ${sess.id}` : null].filter(Boolean).join(" · "),
      empresa_responsable: resp(m), sponsor_responsable: resp(sess.repUserId),
    }));
  });
  const del = await fetch(`${URL_}/rest/v1/meetings_1to1?event_id=eq.${EVENT}`, { method: "DELETE", headers: H });
  if (!del.ok) throw new Error(await del.text());
  for (let i = 0; i < rows.length; i += 100) {
    const ins = await fetch(`${URL_}/rest/v1/meetings_1to1`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 100)) });
    if (!ins.ok) throw new Error(`Insertadas ${i}: ${await ins.text()}`);
  }
  console.log(`Escritas ${rows.length} reuniones en borrador.`);
}
