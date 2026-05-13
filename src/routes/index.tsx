import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Building2, Sparkles, Calendar, Users, Heart, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CONECTAMOS MATCH — Conectamos talento con oportunidad" },
      { name: "description", content: "Plataforma B2B de matchmaking que conecta empresas y sponsors a través de eventos curados." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted text-uppercase-wide">
              Iniciar sesión
            </Link>
            <Link to="/registro" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 text-uppercase-wide">
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-30"
               style={{ background: "radial-gradient(circle at 30% 20%, oklch(0.83 0.16 87 / 0.18), transparent 50%), radial-gradient(circle at 80% 60%, oklch(0.83 0.16 87 / 0.10), transparent 50%)" }} />
          <div className="mx-auto max-w-7xl px-6 py-24 md:py-36 text-center">
            <span className="inline-block rounded-full border border-border px-3 py-1 text-xs text-uppercase-wide text-muted-foreground">
              by Conectamos.club
            </span>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-tight text-uppercase-wide">
              Conectamos Match
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Conectamos el talento con la oportunidad. Matchmaking B2B curado entre empresas
              y sponsors a través de eventos de networking de alto nivel.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/registro" search={{ role: "empresa" }} className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 text-uppercase-wide">
                <Building2 className="h-4 w-4" /> Soy Empresa
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/registro" search={{ role: "sponsor" }} className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-bold hover:bg-muted text-uppercase-wide">
                <Sparkles className="h-4 w-4" /> Soy Sponsor
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h2 className="font-display text-3xl font-bold text-uppercase-wide text-center">Cómo funciona</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { icon: Users, n: "01", t: "Crea tu ficha", d: "Empresa o sponsor — completa tu perfil con descripción, sector y categorías." },
                { icon: Heart, n: "02", t: "Da like y matchea", d: "Explora perfiles y dale like a quienes te interesen. Si hay reciprocidad, se crea un match." },
                { icon: Calendar, n: "03", t: "Reúnete 1:1", d: "El equipo asigna reuniones 1to1 entre matches dentro del evento." },
              ].map(({ icon: Icon, n, t, d }) => (
                <div key={n} className="rounded-xl border border-border bg-card p-6 card-hover">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="font-display text-xs text-muted-foreground">{n}</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-bold text-uppercase-wide">{t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-7xl px-6 py-20 grid md:grid-cols-3 gap-6">
            {[
              { icon: Heart, t: "Matchmaking curado", d: "Algoritmo de doble like que garantiza interés mutuo antes del match." },
              { icon: Calendar, t: "Agenda integrada", d: "Charlas, networking y reuniones 1to1 organizadas en una sola vista." },
              { icon: MessageSquare, t: "Mensajería directa", d: "Habla con tus matches y otros perfiles del evento en tiempo real." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-xl border border-border bg-background p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold text-uppercase-wide">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Conectamos.club — Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
