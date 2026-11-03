import { createFileRoute } from "@tanstack/react-router";
import { RetoMissions } from "@/components/reto/RetoMissions";

export const Route = createFileRoute("/_authenticated/empresa/reto-misiones")({
  head: () => ({
    meta: [
      { title: "Misiones · Reto 2.700 · Conectamos" },
      { name: "description", content: "Misiones del Reto 2.700: progreso, bonus conseguidos e historial de puntos." },
      { property: "og:title", content: "Misiones · Reto 2.700" },
      { property: "og:description", content: "Misiones del Reto 2.700: progreso, bonus conseguidos e historial de puntos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetoMissions,
});
