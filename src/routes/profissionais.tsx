import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell, Reveal } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Clínica Zoe" },
      {
        name: "description",
        content: "Conheça os profissionais da Clínica Zoe e escolha o especialista ideal para você.",
      },
      { property: "og:title", content: "Profissionais — Clínica Zoe" },
      { property: "og:description", content: "Nosso time de especialistas." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/profissionais" }],
  }),
  component: ProfissionaisPublicos,
});

function ProfissionaisPublicos() {
  const { data, isLoading } = useQuery({
    queryKey: ["site-profissionais-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select(
          "id, nome, foto_url, descricao, valor_consulta_avista, valor_consulta_cartao, especialidade:especialidades(nome)",
        )
        .eq("status", "ATIVO")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <SiteShell>
      <section className="border-b border-border bg-gradient-to-br from-secondary via-background to-surface-muted py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Profissionais</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Nosso time de especialistas
            </h1>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {isLoading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data?.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <div className="group h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition hover:-translate-y-1 hover:shadow-elegant">
                    <div className="aspect-[4/5] w-full overflow-hidden bg-secondary">
                      {p.foto_url ? (
                        <img
                          src={p.foto_url}
                          alt={p.nome}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-primary-dark/40">
                          <Sparkles className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-medium text-primary">
                        {(p.especialidade as any)?.nome ?? "Especialista"}
                      </p>
                      <h3 className="mt-1 truncate text-lg font-semibold">{p.nome}</h3>
                      {p.descricao && (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.descricao}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {p.valor_consulta_avista && (
                          <span>
                            À vista:{" "}
                            <span className="font-semibold text-foreground">
                              {Number(p.valor_consulta_avista).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </span>
                        )}
                        {p.valor_consulta_cartao && (
                          <span>
                            Cartão:{" "}
                            <span className="font-semibold text-foreground">
                              {Number(p.valor_consulta_cartao).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                      <Link to="/agendamento" className="mt-5 inline-flex">
                        <Button size="sm" className="rounded-full">
                          Agendar consulta
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Reveal>
              ))}
              {!data?.length && (
                <p className="col-span-full text-sm text-muted-foreground">
                  Nenhum profissional cadastrado ainda.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
