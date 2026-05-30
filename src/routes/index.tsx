import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Building2, Sparkles, Calendar, Users, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CONECTAMOS MATCH — Conectamos talento con oportunidad" },
      { name: "description", content: "Plataforma B2B de matchmaking que conecta empresas y soluciones a través de eventos curados." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-2">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-muted">
              Iniciar sesión
            </Link>
            <a href="mailto:hola@conectamos.club?subject=Quiero%20apuntarme" className="rounded-full bg-brand-gradient px-5 py-2 text-sm font-semibold text-white shadow-brand hover:opacity-95 transition">
              Solicitar acceso
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 50% at 15% 10%, color-mix(in oklab, var(--brand-from) 22%, transparent), transparent 60%), radial-gradient(50% 50% at 90% 30%, color-mix(in oklab, var(--brand-to) 18%, transparent), transparent 60%)",
            }}
          />
          <div className="mx-auto max-w-7xl px-6 py-24 md:py-36 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient" /> by conectamos.club
              </span>
              <h1 className="mt-6 font-display text-5xl md:text-6xl font-bold tracking-tight">
                Conectamos a personas con los <span className="text-brand-gradient">mismos retos</span> e inquietudes.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Matchmaking B2B curado entre empresas y soluciones. Eventos online y presenciales
                donde C-Levels conectan, conversan y descubren soluciones reales.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a href="mailto:hola@conectamos.club?subject=Quiero%20apuntarme" className="group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white shadow-brand hover:opacity-95 transition">
                  Solicitar acceso
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a href="#como-funciona" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">
                  Cómo funciona
                </a>
              </div>
              <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
                <div><span className="font-display text-2xl font-bold text-foreground">10–12</span><div>asistentes por evento</div></div>
                <div className="h-8 w-px bg-border" />
                <div><span className="font-display text-2xl font-bold text-foreground">100%</span><div>perfiles curados</div></div>
                <div className="h-8 w-px bg-border" />
                <div><span className="font-display text-2xl font-bold text-foreground">1:1</span><div>reuniones garantizadas</div></div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-brand-gradient opacity-20 blur-3xl" />
              <div className="relative rounded-3xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-brand-gradient" />
                    <div>
                      <div className="text-sm font-semibold">Acme Corp · CTO</div>
                      <div className="text-xs text-muted-foreground">Buscamos partner cloud</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">MATCH</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { t: "Northwave", s: "Solución Platinum" },
                    { t: "Lumen Cloud", s: "Solución Gold" },
                    { t: "Ironbyte", s: "Solución Silver" },
                    { t: "Verde IT", s: "Solución Bronze" },
                  ].map((c) => (
                    <div key={c.t} className="rounded-xl border border-border p-3">
                      <div className="h-8 w-8 rounded-lg bg-brand-gradient opacity-80" />
                      <div className="mt-2 text-sm font-semibold">{c.t}</div>
                      <div className="text-[11px] text-muted-foreground">{c.s}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">3 nuevos likes</span> esperan tu respuesta.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="como-funciona" className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold text-uppercase-wide text-primary">Cómo funciona</span>
              <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold tracking-tight">
                Un evento de 10–12 personas parecidas a ti.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nos encargamos de absolutamente todo: organizamos, filtramos invitados y preparamos
                un conjunto de soluciones escogidos para cada ocasión.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { icon: Users, n: "01", t: "Crea tu ficha", d: "Empresa o solución — completa tu perfil con descripción, sector y categorías." },
                { icon: Heart, n: "02", t: "Da like y matchea", d: "Explora perfiles y dale like. Si hay reciprocidad, se crea un match automático." },
                { icon: Calendar, n: "03", t: "Reúnete 1:1", d: "El equipo asigna reuniones uno a uno entre matches dentro del evento." },
              ].map(({ icon: Icon, n, t, d }) => (
                <div key={n} className="rounded-2xl border border-border bg-card p-6 card-hover">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-display text-xs text-muted-foreground">{n}</span>
                  </div>
                  <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="border-t border-border bg-muted/40">
          <div className="mx-auto max-w-7xl px-6 py-20 grid md:grid-cols-3 gap-6">
            {[
              { icon: Heart, t: "Matchmaking curado", d: "Algoritmo de doble like que garantiza interés mutuo antes del match." },
              { icon: Calendar, t: "Agenda integrada", d: "Charlas, networking y reuniones 1:1 en una sola vista." },
              { icon: Users, t: "Equipo colaborativo", d: "Invita a varios responsables a gestionar la cuenta de tu organización." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-border bg-background p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="rounded-3xl bg-brand-gradient p-10 md:p-16 text-white shadow-brand flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                  ¿Listo para tu próximo match?
                </h2>
                <p className="mt-2 text-white/80 max-w-xl">
                  Únete a la red de C-Levels y soluciones que están construyendo el próximo gran negocio.
                </p>
              </div>
              <div className="flex gap-3">
                <a href="mailto:hola@conectamos.club?subject=Soy%20Empresa" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-foreground hover:bg-white/90">
                  <Building2 className="h-4 w-4" /> Soy Empresa
                </a>
                <a href="mailto:hola@conectamos.club?subject=Soy%20Sponsor" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
                  <Sparkles className="h-4 w-4" /> Soy Solución
                </a>
              </div>
            </div>
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
