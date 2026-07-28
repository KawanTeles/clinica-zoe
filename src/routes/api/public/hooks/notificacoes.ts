import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina agendada (pg_cron): gera lembretes 24h/2h e processa a fila.
 * Autenticada pela chave publicável do backend (header `apikey`).
 */
export const Route = createFileRoute("/api/public/hooks/notificacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { gerarLembretes, processQueue } = await import(
            "@/lib/notifications/queue.server"
          );
          const criados = await gerarLembretes();
          const fila = await processQueue(50);
          return Response.json({ ok: true, lembretes: criados, processados: fila.processed });
        } catch (e) {
          console.error("[cron:notificacoes]", e);
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
