import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";

export type SortDir = "asc" | "desc";

export function SortToggle({ value, onChange, label = "Orden" }: { value: SortDir; onChange: (v: SortDir) => void; label?: string }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden" title={label}>
      <button
        type="button"
        onClick={() => onChange("asc")}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-uppercase-wide ${value === "asc" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
      >
        <ArrowDownAZ className="h-3.5 w-3.5" /> A→Z
      </button>
      <button
        type="button"
        onClick={() => onChange("desc")}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-uppercase-wide border-l border-border ${value === "desc" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
      >
        <ArrowUpAZ className="h-3.5 w-3.5" /> Z→A
      </button>
    </div>
  );
}

export function sortByName<T>(arr: T[], getName: (item: T) => string | null | undefined, dir: SortDir): T[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...arr].sort((a, b) => mult * (getName(a) ?? "").localeCompare(getName(b) ?? "", "es", { sensitivity: "base" }));
}
