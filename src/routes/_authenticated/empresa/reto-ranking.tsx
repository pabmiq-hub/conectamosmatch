import { createFileRoute } from "@tanstack/react-router";
import { RetoRanking } from "@/components/reto/RetoRanking";

export const Route = createFileRoute("/_authenticated/empresa/reto-ranking")({
  head: () => ({
    meta: [
      { title: "Ranking · Reto 2.700 · Conectamos" },
      { name: "description", content: "Marcador colectivo del Reto 2.700 y rankings de conexiones y puntos." },
      { property: "og:title", content: "Ranking · Reto 2.700" },
      { property: "og:description", content: "Marcador colectivo del Reto 2.700 y rankings de conexiones y puntos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetoRanking,
});
