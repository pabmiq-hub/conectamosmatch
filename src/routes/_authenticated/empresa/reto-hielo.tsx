import { createFileRoute } from "@tanstack/react-router";
import { RetoIcebreaker } from "@/components/reto/RetoIcebreaker";

export const Route = createFileRoute("/_authenticated/empresa/reto-hielo")({
  head: () => ({
    meta: [
      { title: "Rompe el hielo · Reto 2.700 · Conectamos" },
      { name: "description", content: "Comodines de conversación para empezar a hablar con otros asistentes del Reto 2.700." },
      { property: "og:title", content: "Rompe el hielo · Reto 2.700" },
      { property: "og:description", content: "Comodines de conversación para empezar a hablar con otros asistentes del Reto 2.700." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetoIcebreaker,
});
