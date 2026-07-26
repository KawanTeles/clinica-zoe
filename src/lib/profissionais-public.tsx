import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAvatarUrl, initialsOf } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type ProfissionalPublico = {
  id: string;
  nome: string;
  foto_url: string | null;
  descricao: string | null;
  formacao: string | null;
  anos_experiencia: number | null;
  registro_profissional: string | null;
  valor_consulta_avista: number | null;
  valor_consulta_cartao: number | null;
  especialidade?: { nome: string } | null;
};

const SELECT =
  "id, nome, foto_url, descricao, formacao, anos_experiencia, registro_profissional, valor_consulta_avista, valor_consulta_cartao, especialidade:especialidades(nome)";

/**
 * Fonte única do site público: a view `profissionais_public`,
 * que já expõe apenas profissionais com status ATIVO.
 */
export function useProfissionaisPublicos(limit?: number) {
  return useQuery({
    queryKey: ["profissionais-publicos", limit ?? "all"],
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    queryFn: async () => {
      let q = (supabase as any).from("profissionais_public").select(SELECT).order("nome");
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProfissionalPublico[];
    },
  });
}

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Foto 1:1, alta qualidade, object-cover, com fallback elegante nas iniciais. */
export function ProfissionalFoto({
  nome,
  fotoUrl,
  className,
}: {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
}) {
  const url = useAvatarUrl(fotoUrl);
  return (
    <div
      className={cn(
        "aspect-square w-full overflow-hidden rounded-2xl bg-secondary",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt={`Foto de ${nome}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-linear-to-br from-secondary to-surface-muted">
          <span className="text-3xl font-semibold tracking-wide text-primary/70 sm:text-4xl">
            {initialsOf(nome)}
          </span>
        </div>
      )}
    </div>
  );
}

export function ProfissionalCard({
  p,
  compact = false,
}: {
  p: ProfissionalPublico;
  compact?: boolean;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant sm:p-5">
      <ProfissionalFoto nome={p.nome} fotoUrl={p.foto_url} />

      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-xs font-medium text-primary">
          {p.especialidade?.nome ?? "Especialista"}
        </p>
        <h3 className="mt-1 text-base font-semibold sm:text-lg">{p.nome}</h3>

        {p.descricao && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.descricao}</p>
        )}

        {!compact && (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {p.formacao && (
              <li>
                Formação: <span className="text-foreground">{p.formacao}</span>
              </li>
            )}
            {p.anos_experiencia ? (
              <li>
                Experiência: <span className="text-foreground">{p.anos_experiencia} anos</span>
              </li>
            ) : null}
            {p.registro_profissional && (
              <li>
                Registro: <span className="text-foreground">{p.registro_profissional}</span>
              </li>
            )}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {p.valor_consulta_avista ? (
            <span>
              À vista:{" "}
              <span className="font-semibold text-foreground">{brl(p.valor_consulta_avista)}</span>
            </span>
          ) : null}
          {p.valor_consulta_cartao ? (
            <span>
              Cartão:{" "}
              <span className="font-semibold text-foreground">{brl(p.valor_consulta_cartao)}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          <Link to="/agendamento">
            <Button size="sm" className="rounded-full">
              Agendar consulta
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}
