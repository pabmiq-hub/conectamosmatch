import { createFileRoute } from "@tanstack/react-router";
import { RetoAlbum } from "@/components/reto/RetoAlbum";

export const Route = createFileRoute("/_authenticated/empresa/reto")({
  head: () => ({
    meta: [
      { title: "Mi álbum · Reto 2.700 · Conectamos" },
      { name: "description", content: "Marca tus conexiones del Reto 2.700 y valida las recíprocas." },
      { property: "og:title", content: "Mi álbum · Reto 2.700" },
      { property: "og:description", content: "Marca tus conexiones del Reto 2.700 y valida las recíprocas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetoAlbum,
});
