import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload, Download, FileSpreadsheet, Users, Crown, ArrowLeft, Scissors, Merge, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { analyzeExcelGroups, confirmGroupedImport } from "@/lib/admin-users.functions";

type AccountType = "empresa" | "sponsor";

/** Cabeceras en español (o variantes) → columna interna. */
const HEADER_ALIASES: Record<string, string> = {
  nombre: "full_name", "nombre completo": "full_name", "nombre y apellidos": "full_name", responsable: "full_name",
  email: "email", correo: "email", "correo electronico": "email", "e-mail": "email",
  contrasena: "password", password: "password",
  telefono: "phone", movil: "phone", phone: "phone",
  puesto: "role", cargo: "role", "job title": "role", job_title: "role", role: "role",
  empresa: "company_name", compania: "company_name", solucion: "company_name", cuenta: "company_name", company_name: "company_name",
  sector: "sector", web: "website", website: "website", "pagina web": "website", linkedin: "linkedin_url", linkedin_url: "linkedin_url",
  eslogan: "tagline", tagline: "tagline",
  descripcion: "description", "descripcion empresa": "description", "descripcion de la empresa": "description", description: "description",
  tamano: "company_size", "tamano empresa": "company_size", company_size: "company_size",
  ciudad: "location_city", location_city: "location_city",
  retos: "looking_for", "que busca": "looking_for", looking_for: "looking_for",
  categoria: "sponsorship_category", sponsorship_category: "sponsorship_category",
  modalidad: "sponsorship_level", nivel: "sponsorship_level", "tipo sponsor": "sponsorship_level", patrocinio: "sponsorship_level", sponsorship_level: "sponsorship_level",
  "publico objetivo": "target_audience", target_audience: "target_audience",
};
function normHeader(h: string) {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function mapRow(r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    const key = HEADER_ALIASES[normHeader(k)] ?? k;
    if (out[key] === undefined || out[key] === "") out[key] = v;
  }
  return out;
}

type GroupMember = {
  idx: number;
  full_name: string;
  email: string;
  phone: string;
  suggested_admin: boolean;
};

type Group = {
  id: string;
  account_type: AccountType;
  suggested_company_name: string;
  members: GroupMember[];
  account_fields: Record<string, any>;
};

type WorkingGroup = Group & {
  company_name: string;
  admin_idx: number;
};

export function ImportUsersModal({ onClose, onDone, defaultEventId }: { onClose: () => void; onDone: () => void; defaultEventId?: string }) {
  const analyzeFn = useServerFn(analyzeExcelGroups);
  const confirmFn = useServerFn(confirmGroupedImport);

  const [step, setStep] = useState<"type" | "upload" | "review" | "result">("type");
  const [accountType, setAccountType] = useState<AccountType>("empresa");
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<WorkingGroup[]>([]);
  const [rowsByIdx, setRowsByIdx] = useState<Record<string, any>>({});
  const [parseErrors, setParseErrors] = useState<{ idx: number; email: string; error: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventId, setEventId] = useState<string>(defaultEventId ?? "");
  useEffect(() => {
    supabase.from("events").select("id, title, status").order("event_date", { ascending: false }).then(({ data }) => {
      setEvents((data ?? []).filter((e: any) => e.status !== "cancelled"));
    });
  }, []);
  const [result, setResult] = useState<{ created: number; failed: { email: string; error: string }[] } | null>(null);

  function downloadTemplate(type: AccountType) {
    let rows: Record<string, any>[];
    let filename: string;
    if (type === "empresa") {
      rows = [
        { Nombre: "Ana López", Email: "ana@acme.com", "Contraseña": "", "Teléfono": "+34600000000", Puesto: "CEO", Empresa: "Acme SL", "Descripción": "Qué hace la empresa", Sector: "Tech", "Tamaño": "11-50", Ciudad: "Madrid", Web: "https://acme.com", LinkedIn: "", Retos: "Qué busca en el evento" },
        { Nombre: "Luis Pérez", Email: "luis@acme.com", "Contraseña": "", "Teléfono": "", Puesto: "Director de Marketing", Empresa: "Acme SL", "Descripción": "", Sector: "", "Tamaño": "", Ciudad: "", Web: "", LinkedIn: "", Retos: "" },
      ];
      filename = "plantilla-empresas.xlsx";
    } else {
      rows = [
        { Nombre: "Marta Ruiz", Email: "marta@solucion.com", "Contraseña": "", "Teléfono": "", Puesto: "Head of Partnerships", Empresa: "Solución SA", "Descripción": "Qué ofrece la solución", Modalidad: "GOLD", "Categoría": "Cloud", Sector: "Cloud", Ciudad: "Barcelona", Web: "https://solucion.com", LinkedIn: "", "Público objetivo": "A quién se dirige y qué retos resuelve" },
        { Nombre: "Carlos Gil", Email: "carlos@solucion.com", "Contraseña": "", "Teléfono": "", Puesto: "Sales Manager", Empresa: "Solución SA", "Descripción": "", Modalidad: "GOLD", "Categoría": "", Sector: "", Ciudad: "", Web: "", LinkedIn: "", "Público objetivo": "" },
      ];
      filename = "plantilla-soluciones.xlsx";
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === "empresa" ? "Empresas" : "Soluciones");
    XLSX.writeFile(wb, filename);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (!rawRows.length) {
        toast.error("El fichero está vacío");
        return;
      }
      // Force account_type from the selected flow so the user doesn't have to fill it
      const rows = rawRows.map((r) => ({ ...mapRow(r), account_type: accountType }));
      const res = await analyzeFn({ data: { rows } });
      const wg: WorkingGroup[] = res.groups.map((g) => {
        const adminMember = g.members.find((m) => m.suggested_admin) ?? g.members[0];
        return { ...g, company_name: g.suggested_company_name, admin_idx: adminMember.idx };
      });
      setGroups(wg);
      setRowsByIdx(res.rows_by_idx);
      setParseErrors(res.errors);
      setStep("review");
    } catch (err: any) {
      toast.error(err?.message ?? "Error procesando el fichero");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function setAdmin(groupId: string, idx: number) {
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, admin_idx: idx } : g)));
  }

  function setCompanyName(groupId: string, name: string) {
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, company_name: name } : g)));
  }

  function splitMember(groupId: string, memberIdx: number) {
    setGroups((gs) => {
      const g = gs.find((x) => x.id === groupId);
      if (!g || g.members.length <= 1) return gs;
      const member = g.members.find((m) => m.idx === memberIdx);
      if (!member) return gs;
      const remaining = g.members.filter((m) => m.idx !== memberIdx);
      const updatedOriginal: WorkingGroup = {
        ...g,
        members: remaining,
        admin_idx: g.admin_idx === memberIdx ? remaining[0].idx : g.admin_idx,
      };
      const newGroup: WorkingGroup = {
        ...g,
        id: `${g.id}-split-${memberIdx}`,
        members: [member],
        company_name: rowsByIdx[String(memberIdx)]?.company_name ?? g.company_name,
        admin_idx: memberIdx,
      };
      return [...gs.map((x) => (x.id === groupId ? updatedOriginal : x)), newGroup];
    });
  }

  function mergeWithPrevious(groupId: string) {
    setGroups((gs) => {
      const i = gs.findIndex((g) => g.id === groupId);
      if (i <= 0) return gs;
      const prev = gs[i - 1];
      const curr = gs[i];
      if (prev.account_type !== curr.account_type) {
        toast.error("Solo se pueden fusionar cuentas del mismo tipo");
        return gs;
      }
      const merged: WorkingGroup = { ...prev, members: [...prev.members, ...curr.members] };
      return [...gs.slice(0, i - 1), merged, ...gs.slice(i + 1)];
    });
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const payload = {
        groups: groups.map((g) => ({
          account_type: g.account_type,
          company_name: g.company_name,
          admin_idx: g.admin_idx,
          member_idxs: g.members.map((m) => m.idx),
          account_fields: g.account_fields,
        })),
        rows_by_idx: rowsByIdx,
        event_id: eventId || null,
      };
      const res = await confirmFn({ data: payload });
      setResult({ created: res.created_accounts.length, failed: res.failed });
      setStep("result");
      onDone();
      toast.success(`${res.created_accounts.length} cuenta(s) creada(s)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Error en la confirmación");
    } finally {
      setBusy(false);
    }
  }

  const totalMembers = groups.reduce((acc, g) => acc + g.members.length, 0);
  const typeLabel = accountType === "empresa" ? "empresas" : "soluciones";
  const requiredCols = accountType === "empresa"
    ? "Nombre, Email, Empresa"
    : "Nombre, Email, Empresa, Modalidad";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {(step === "upload" || step === "review") && (
              <button
                onClick={() => {
                  if (step === "review") { setStep("upload"); setGroups([]); }
                  else { setStep("type"); }
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="font-display text-lg font-bold text-uppercase-wide">
              {step === "type" && "Importar usuarios desde Excel"}
              {step === "upload" && `Importar ${typeLabel} desde Excel`}
              {step === "review" && `Revisar agrupaciones (${groups.length} cuentas · ${totalMembers} responsables)`}
              {step === "result" && "Importación completada"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-[10px] text-uppercase-wide">
          {[
            { k: "type", label: "1. Tipo" },
            { k: "upload", label: "2. Subir" },
            { k: "review", label: "3. Revisar" },
            { k: "result", label: "4. Resultado" },
          ].map((s) => (
            <div key={s.k} className={`flex-1 rounded-md px-3 py-1.5 font-bold border ${step === s.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {s.label}
            </div>
          ))}
        </div>

        {step === "type" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              ¿Qué tipo de cuentas quieres importar? Cada tipo usa una <strong className="text-foreground">plantilla distinta</strong> con las columnas adecuadas para evitar errores.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setAccountType("empresa"); setStep("upload"); }}
                className="group rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 p-5 text-left transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[9px] font-bold text-uppercase-wide">Empresa</span>
                </div>
                <div className="font-bold text-sm mb-1">Importar empresas</div>
                <div className="text-xs text-muted-foreground">Para cuentas de empresa que buscan soluciones. Incluye sector, tamaño y ubicación.</div>
              </button>
              <button
                onClick={() => { setAccountType("sponsor"); setStep("upload"); }}
                className="group rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/5 p-5 text-left transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-accent-foreground" />
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-[9px] font-bold text-uppercase-wide">Solución</span>
                </div>
                <div className="font-bold text-sm mb-1">Importar soluciones</div>
                <div className="text-xs text-muted-foreground">Para cuentas de solución/sponsor. Incluye categoría y nivel de sponsorship.</div>
              </button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground space-y-2">
              <p>Estás importando <strong className="text-foreground">{typeLabel}</strong>. La plataforma agrupará automáticamente a las personas de la misma cuenta (por nombre o dominio de email).</p>
              <p>Columnas obligatorias: <strong className="text-foreground">{requiredCols}</strong>. Si falta la contraseña, se genera una automáticamente.</p>
              <p>Puedes usar cabeceras en español: <strong className="text-foreground">Nombre, Email, Teléfono, Puesto (o Cargo), Empresa, Descripción, Sector, Web, Ciudad</strong>{accountType === "sponsor" && <>, <strong className="text-foreground">Modalidad</strong> (Platinum, Gold, Silver…; marca su tope de reuniones), <strong className="text-foreground">Categoría</strong> y <strong className="text-foreground">Público objetivo</strong></>}. El puesto y la descripción quedan precargados en «Mi Ficha» y se pueden editar.</p>
              <p>Si la cuenta ya existe (mismo nombre), no se duplica: se completan sus datos y se añaden las personas nuevas.</p>
            </div>
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Inscribir en el evento (opcional)</label>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
                <option value="">No inscribir en ningún evento</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
            <button onClick={() => downloadTemplate(accountType)} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-xs font-bold text-uppercase-wide hover:bg-muted">
              <Download className="h-4 w-4" /> Descargar plantilla de {typeLabel}
            </button>
            <label className="block w-full">
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="hidden" />
              <span className={`flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground text-uppercase-wide cursor-pointer ${busy ? "opacity-50" : ""}`}>
                <Upload className="h-4 w-4" /> {busy ? "Analizando…" : `Subir Excel de ${typeLabel}`}
              </span>
            </label>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {parseErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <div className="font-bold mb-1">{parseErrors.length} fila(s) con errores (se omitirán):</div>
                <ul className="space-y-0.5">
                  {parseErrors.slice(0, 8).map((e) => (
                    <li key={e.idx}><span className="font-mono">{e.email}</span> — <span className="text-destructive">{e.error}</span></li>
                  ))}
                  {parseErrors.length > 8 && <li>…y {parseErrors.length - 8} más</li>}
                </ul>
              </div>
            )}

            {groups.map((g, gi) => (
              <div key={g.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold text-uppercase-wide ${g.account_type === "empresa" ? "bg-primary/10 text-primary" : "bg-accent/30"}`}>
                      <Users className="h-3 w-3" /> {g.account_type === "empresa" ? "Empresa" : "Solución"}
                    </div>
                  </div>
                  <input
                    value={g.company_name}
                    onChange={(e) => setCompanyName(g.id, e.target.value)}
                    className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-sm font-bold"
                    placeholder="Nombre de la cuenta"
                  />
                  {gi > 0 && groups[gi - 1].account_type === g.account_type && (
                    <button
                      type="button"
                      onClick={() => mergeWithPrevious(g.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-bold text-uppercase-wide hover:bg-muted"
                      title="Fusionar con la cuenta de arriba"
                    >
                      <Merge className="h-3 w-3" /> Fusionar
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {g.members.map((m) => (
                    <div key={m.idx} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="radio"
                          name={`admin-${g.id}`}
                          checked={g.admin_idx === m.idx}
                          onChange={() => setAdmin(g.id, m.idx)}
                          className="accent-primary"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {m.full_name}
                            {g.admin_idx === m.idx && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 px-2 py-0.5 text-[9px] font-bold text-uppercase-wide">
                                <Crown className="h-2.5 w-2.5" /> Admin
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
                        </div>
                      </label>
                      {g.members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => splitMember(g.id, m.idx)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Separar en su propia cuenta"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {g.members.length === 1 && (
                  <p className="text-[10px] text-muted-foreground italic">Una sola persona — será automáticamente el administrador de la cuenta.</p>
                )}
              </div>
            ))}

            <div className="sticky bottom-0 -mx-6 -mb-6 bg-card border-t border-border px-6 py-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Se crearán <strong className="text-foreground">{groups.length}</strong> cuenta(s) con <strong className="text-foreground">{totalMembers}</strong> responsable(s).
              </span>
              <button
                onClick={handleConfirm}
                disabled={busy || !groups.length}
                className="rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground text-uppercase-wide disabled:opacity-50"
              >
                {busy ? "Creando…" : "Confirmar e importar"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                <FileSpreadsheet className="h-6 w-6 text-success mx-auto" />
                <div className="mt-2 text-2xl font-bold">{result.created}</div>
                <div className="text-[10px] text-uppercase-wide text-muted-foreground">Cuentas creadas</div>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                <FileSpreadsheet className="h-6 w-6 text-destructive mx-auto" />
                <div className="mt-2 text-2xl font-bold">{result.failed.length}</div>
                <div className="text-[10px] text-uppercase-wide text-muted-foreground">Errores</div>
              </div>
            </div>
            {result.failed.length > 0 && (
              <div className="rounded-lg border border-border bg-background p-3 max-h-60 overflow-y-auto">
                <div className="text-xs font-bold mb-2">Errores:</div>
                <ul className="space-y-1 text-xs">
                  {result.failed.map((f, i) => (
                    <li key={i}><span className="font-mono">{f.email}</span> — <span className="text-destructive">{f.error}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={onClose} className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground text-uppercase-wide">Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
