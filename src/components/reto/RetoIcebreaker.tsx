import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/dashboard/EmptyState";
import { fetchIcebreakers, getMyActiveRetoEvent, pickIcebreaker } from "@/lib/reto";
import { MessageCircleQuestion, Shuffle } from "lucide-react";

/** «Rompe el hielo»: random conversation card. Nothing is saved and no points are awarded. */
export function RetoIcebreaker() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [flip, setFlip] = useState(0);
  const [loading, setLoading] = useState(true);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const ev = await getMyActiveRetoEvent(user.id);
      setEventId(ev);
      if (ev) setQuestions(await fetchIcebreakers(ev));
      setLoading(false);
    })();
  }, []);

  const draw = () => {
    const i = pickIcebreaker(questions.length, lastRef.current);
    lastRef.current = i;
    setCurrent(i);
    setFlip((f) => f + 1);
  };

  if (loading) return <div className="text-xs text-muted-foreground text-uppercase-wide">Cargando…</div>;
  if (!eventId) return <EmptyState icon={MessageCircleQuestion} title="El Reto 2.700 no está activo" hint="Aparecerá aquí cuando empiece el evento." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Rompe el hielo" subtitle="Pide un comodín y enséñaselo a la persona con la que hablas. No suma puntos ni se guarda nada." />

      <div className="mx-auto w-full max-w-xl">
        <div
          key={flip}
          className="relative flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-primary bg-card p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300"
        >
          {current === null ? (
            <>
              <MessageCircleQuestion className="h-12 w-12 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Pulsa el botón para sacar tu primer comodín.</p>
            </>
          ) : (
            <>
              <span className="absolute left-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                {String(current + 1).padStart(2, "0")} / {questions.length}
              </span>
              <p className="font-display text-2xl md:text-3xl font-bold leading-snug text-foreground">
                {questions[current]}
              </p>
            </>
          )}
        </div>

        <button
          onClick={draw}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground text-uppercase-wide shadow transition active:scale-[0.98] hover:opacity-90"
        >
          <Shuffle className="h-5 w-5" /> {current === null ? "Dame un comodín" : "Otro comodín"}
        </button>
      </div>
    </div>
  );
}
