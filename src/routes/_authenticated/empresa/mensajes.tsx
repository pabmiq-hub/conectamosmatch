import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/components/chat/ChatPage";

export const Route = createFileRoute("/_authenticated/empresa/mensajes")({
  head: () => ({ meta: [{ title: "Mensajes · Conectamos Match" }] }),
  component: ChatPage,
});
