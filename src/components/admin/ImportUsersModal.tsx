import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Upload, Download, FileSpreadsheet, Users, Crown, ArrowLeft, Scissors, Merge } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { analyzeExcelGroups, confirmGroupedImport } from "@/lib/admin-users.functions";

type GroupMember = {
  idx: number;
  full_name: string;
  email: string;
  phone: string;
  suggested_admin: boolean;
};

type Group = {
  id: string;
  account_type: "empresa" | "sponsor";
  suggested_company_name: string;
  members: GroupMember[];
  account_fields: Record<string, any>;
};

type WorkingGroup = Group & {
  company_name: string;
  admin_idx: number; // selected admin
};

export function ImportUsersModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const analyzeFn = useServerFn(analyzeExcelGroups);
  const confirmFn = useServerFn(confirmGroupedImport);

  const [step, setStep] = useState<"upload" | "review" | "result">("upload");
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<WorkingGroup[]>([]);
  const [rowsByIdx, setRowsByIdx] = useState<Record<string, any>>({});
  const [parseErrors, setParseErrors] = useState<{ idx: number; email: string; error: string }[]>([]);
  const [result, setResult] = useState<{ created: number; failed: { email: string; error: string }[] } | null>(null);

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { full_name: "Ana López", email: "ana@acme.com", password: "Cambiame123", account_type: "empresa", phone: "+34600000000", company_name: "Acme SL", sector: "Tech", company_size: "11-50", location_city: "Madrid", website: "https://acme.com", linkedin_url: "", tagline: "", description: "" },
      { full_name: "Luis Pérez", email: "luis@acme.com", password: "Cambiame123", account_type: "empresa", phone: "", company_name: "Acme SL", sector: "Tech", company_size: "11-50", location_city: "Madrid", website: "https://acme.com", linkedin_url: "", tagline: "", description: "" },
      { full_name: "Marta Ruiz", email: "marta@solucion.com", password: "Cambiame123", account_type: "sponsor", phone: "", company_name: "Solución SA", sector: "Cloud", website: "https://solucion.com", linkedin_url: "", tagline: "", description: "", sponsorship_category: "Cloud", sponsorship_level: "GOLD" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "plantilla-usuarios.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (!rows.length) {
        toast.error("El fichero está vacío");
        return;
      }
      const res = await analyzeFn({ data: { rows } });
      const wg: WorkingGroup[] = res.groups.map((g) => {
        const adminMember = g.members.find((m) => m.suggested_admin) ?? g.members[0];
        return {
          ...g,
          company_name: g.suggested_company_name,
          admin_idx: adminMember.idx,
        };
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
      const merged: WorkingGroup = {
        ...prev,
        members: [...prev.members, ...curr.members],
      };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {step === "review" && (
              <button onClick={() => { setStep("upload"); setGroups([]); }} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="font-display text-lg font-bold text-uppercase-wide">
              {step === "upload" && "Importar usuarios desde Excel"}
              {step === "review" && `Revisar agrupaciones (${groups.length} cuentas · ${totalMembers} responsables)`}
              {step === "result" && "Importación completada"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-[10px] text-uppercase-wide">
          {[
            { k: "upload", label: "1. Subir" },
            { k: "review", label: "2. Revisar" },
            { k: "result", label: "3. Resultado" },
          ].map((s) => (
            <div key={s.k} className={`flex-1 rounded-md px-3 py-1.5 font-bold border ${step === s.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
              {s.label}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground space-y-2">
              <p>Sube un Excel con los responsables. La plataforma <strong className="text-foreground">agrupará automáticamente</strong> a las personas de la misma empresa (por nombre o dominio de email).</p>
              <p>Después podrás revisar las agrupaciones, designar el administrador de cada cuenta y separar/fusionar según necesites.</p>
              <p>Columnas obligatorias: <strong className="text-foreground">full_name, email, password, account_type, company_name</strong>.</p>
            </div>
            <button onClick={downloadTemplate} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-xs font-bold text-uppercase-wide">
              <Download className="h-4 w-4" /> Descargar plantilla
            </button>
            <label className="block w-full">
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="hidden" />
              <span className={`flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground text-uppercase-wide cursor-pointer ${busy ? "opacity-50" : ""}`}>
                <Upload className="h-4 w-4" /> {busy ? "Analizando…" : "Subir Excel y analizar"}
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
