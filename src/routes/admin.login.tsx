import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();
        if (p?.role === "super_admin") {
          nav({ to: "/admin" });
        }
      }
    });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user!.id)
      .maybeSingle();
    setLoading(false);
    if (p?.role !== "super_admin") {
      await supabase.auth.signOut();
      toast.error("Esta entrada es solo para administradores");
      return;
    }
    toast.success("Bienvenido, administrador");
    nav({ to: "/admin" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><Logo /></div>
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-uppercase-wide text-center">Acceso administrador</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">Panel de gestión de la plataforma</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-uppercase-wide text-muted-foreground">Contraseña</label>
              <div className="relative mt-1">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-uppercase-wide">
              {loading ? "Entrando…" : "Entrar como admin"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            ¿Eres empresa o solución?{" "}
            <Link to="/login" className="text-primary font-bold hover:underline">Inicia sesión aquí</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
