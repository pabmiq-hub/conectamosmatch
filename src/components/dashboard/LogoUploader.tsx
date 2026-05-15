import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}

export function LogoUploader({ userId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Debe ser una imagen");
    if (file.size > 3 * 1024 * 1024) return toast.error("Máx 3MB");
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
    toast.success("Logo subido");
  }

  return (
    <div>
      <span className="block text-[10px] text-uppercase-wide font-bold text-muted-foreground mb-1.5">Logo</span>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden">
          {value ? (
            <img src={value} alt="logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-uppercase-wide hover:bg-muted disabled:opacity-50">
            <Upload className="h-3 w-3" /> {busy ? "Subiendo…" : value ? "Cambiar logo" : "Subir logo"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)}
              className="inline-flex items-center gap-2 text-[10px] text-uppercase-wide font-bold text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3 w-3" /> Quitar
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
