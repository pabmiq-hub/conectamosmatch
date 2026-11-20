import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Conectamos Match | Encuentros entre empresas y soluciones" }, { name: "description", content: "Accede a tus eventos, selecciones, matches y reuniones en Conectamos Match." }, { property: "og:title", content: "Conectamos Match | Encuentros entre empresas y soluciones" }, { property: "og:description", content: "Conecta con las empresas y soluciones de tu evento." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
