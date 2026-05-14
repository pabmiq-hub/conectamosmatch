import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { dashboardPathFor } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle();
        nav({ to: dashboardPathFor((p?.role as any) ?? "empresa") });
      }
    });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user!.id).maybeSingle();
    toast.success("Sesión iniciada");
    nav({ to: dashboardPathFor((p?.role as any) ?? "empresa") });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="rounded-xl border border-border bg-card p-8">
          <h1 className="font-display text-2xl font-bold text-uppercase-wide text-center">Iniciar sesión</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Accede a tu panel</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-uppercase-wide">
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            ¿Necesitas acceso? Contáctanos en{" "}
            <a href="mailto:hola@conectamos.club" className="text-primary font-bold hover:underline">hola@conectamos.club</a>
          </div>
        </div>
      </div>
    </div>
  );
}
