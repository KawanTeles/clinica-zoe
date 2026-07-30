import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type AvatarBucket = "profissionais" | "clientes" | "pacientes";

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPT = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const AVATAR_OUTPUT_SIZE = 512;

/** Extrai as iniciais elegantes de um nome (máx. 2 letras). */
export function initialsOf(nome?: string | null) {
  const parts = (nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Os valores salvos em foto_url são "bucket/caminho". URLs http continuam funcionando. */
function splitStoragePath(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return { url: value } as const;
  const [bucket, ...rest] = value.split("/");
  if (!bucket || !rest.length) return null;
  return { bucket, path: rest.join("/") } as const;
}

/** Resolve o caminho de storage em uma URL assinada (buckets privados). */
export function useAvatarUrl(value?: string | null) {
  const parsed = splitStoragePath(value);
  const { data } = useQuery({
    queryKey: ["avatar-url", value],
    enabled: !!parsed && !("url" in parsed),
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const p = parsed as { bucket: string; path: string };
      const { data, error } = await supabase.storage
        .from(p.bucket)
        .createSignedUrl(p.path, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });

  if (parsed && "url" in parsed) return parsed.url;
  return data ?? null;
}

const SIZES = {
  xs: "h-8 w-8 text-[10px]",
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-20 w-20 text-lg",
  xl: "h-28 w-28 text-2xl",
} as const;

/** Avatar com fallback elegante nas iniciais do nome. */
export function PersonAvatar({
  nome,
  fotoUrl,
  size = "sm",
  className,
}: {
  nome?: string | null;
  fotoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const url = useAvatarUrl(fotoUrl);
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground ring-1 ring-border",
        SIZES[size],
        className,
      )}
      aria-hidden={!nome}
    >
      {url ? (
        <img
          src={url}
          alt={nome ? `Foto de ${nome}` : "Foto de perfil"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initialsOf(nome)}</span>
      )}
    </div>
  );
}

/** Foto preenchendo o container (cards do site público), com fallback livre. */
export function ProfilePhoto({
  nome,
  fotoUrl,
  fallback,
  className,
}: {
  nome?: string | null;
  fotoUrl?: string | null;
  fallback: React.ReactNode;
  className?: string;
}) {
  const url = useAvatarUrl(fotoUrl);
  if (!url) return <>{fallback}</>;
  return (
    <img
      src={url}
      alt={nome ? `Foto de ${nome}` : "Foto do profissional"}
      loading="lazy"
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
