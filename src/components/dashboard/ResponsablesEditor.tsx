import { Plus, Trash2, User } from "lucide-react";

export interface Responsable {
  full_name: string;
  role: string;
  email: string;
  phone: string;
}

interface Props {
  value: Responsable[];
  onChange: (v: Responsable[]) => void;
  max?: number;
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function ResponsablesEditor({ value, onChange, max = 5 }: Props) {
  const items = Array.isArray(value) ? value : [];

  function update(i: number, patch: Partial<Responsable>) {
    onChange(items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    if (items.length >= max) return;
    onChange([...items, { full_name: "", role: "", email: "", phone: "" }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground">Responsables ({items.length}/{max})</span>
        <button type="button" onClick={add} disabled={items.length >= max}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-bold text-uppercase-wide hover:bg-muted disabled:opacity-50">
          <Plus className="h-3 w-3" /> Añadir
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">Solo el nombre y el cargo serán visibles públicamente. Email y teléfono son privados.</p>
      <div className="space-y-3">
        {items.map((r, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-uppercase-wide font-bold text-muted-foreground">
                <User className="h-3 w-3" /> Responsable {i + 1}
              </span>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input className={inputCls} placeholder="Nombre completo" value={r.full_name} onChange={(e) => update(i, { full_name: e.target.value })} />
              <input className={inputCls} placeholder="Cargo" value={r.role} onChange={(e) => update(i, { role: e.target.value })} />
              <input className={inputCls} placeholder="Email" type="email" value={r.email} onChange={(e) => update(i, { email: e.target.value })} />
              <input className={inputCls} placeholder="Teléfono" value={r.phone} onChange={(e) => update(i, { phone: e.target.value })} />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Aún no hay responsables. Añade hasta {max}.
          </div>
        )}
      </div>
    </div>
  );
}
