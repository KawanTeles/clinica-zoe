import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  AVATAR_ACCEPT,
  AVATAR_MAX_BYTES,
  AVATAR_OUTPUT_SIZE,
  initialsOf,
  useAvatarUrl,
  type AvatarBucket,
} from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const VIEW = 288;

const SIZES = {
  md: "h-16 w-16 text-base",
  lg: "h-24 w-24 text-xl",
  xl: "h-32 w-32 text-3xl",
} as const;

type Props = {
  bucket: AvatarBucket;
  value?: string | null;
  onChange: (next: string | null) => void | Promise<void>;
  nome?: string | null;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  className?: string;
};

/** Upload de foto de perfil com drag & drop, corte 1:1, zoom e progresso. */
export function AvatarUploader({
  bucket,
  value,
  onChange,
  nome,
  size = "lg",
  disabled,
  className,
}: Props) {
  const { user } = useAuth();
  const currentUrl = useAvatarUrl(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState<{ url: string; el: HTMLImageElement } | null>(null);

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (!AVATAR_ACCEPT.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Imagem muito grande. O limite é 5 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setSource({ url, el });
    el.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Não foi possível ler a imagem.");
    };
    el.src = url;
  };

  const closeCrop = useCallback(() => {
    setSource((s) => {
      if (s) URL.revokeObjectURL(s.url);
      return null;
    });
  }, []);

  const upload = async (blob: Blob) => {
    if (!user) {
      toast.error("Sessão expirada. Entre novamente.");
      return;
    }
    setBusy(true);
    setProgress(8);
    const tick = window.setInterval(() => setProgress((p) => (p < 88 ? p + 6 : p)), 120);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const previous = value;
      setProgress(96);
      await onChange(`${bucket}/${path}`);
      setProgress(100);

      if (previous && !/^https?:\/\//i.test(previous) && previous.startsWith(`${bucket}/`)) {
        await supabase.storage.from(bucket).remove([previous.slice(bucket.length + 1)]);
      }
      toast.success("Foto atualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar a foto");
    } finally {
      window.clearInterval(tick);
      window.setTimeout(() => setProgress(0), 400);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!value) return;
    setBusy(true);
    try {
      if (!/^https?:\/\//i.test(value) && value.startsWith(`${bucket}/`)) {
        await supabase.storage.from(bucket).remove([value.slice(bucket.length + 1)]);
      }
      await onChange(null);
      toast.success("Foto removida");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover a foto");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-full bg-secondary ring-1 ring-border transition",
          SIZES[size],
          dragging && "ring-2 ring-primary",
          !disabled && "cursor-pointer",
        )}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={value ? "Alterar foto de perfil" : "Adicionar foto de perfil"}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={nome ? `Foto de ${nome}` : "Foto de perfil"} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center font-semibold text-secondary-foreground">
            {initialsOf(nome)}
          </span>
        )}

        {!disabled && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-background" />
            ) : (
              <Camera className="h-5 w-5 text-background" />
            )}
          </div>
        )}
      </div>

      {progress > 0 && <Progress value={progress} className="h-1.5 w-40" />}

      {!disabled && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" />
            {value ? "Alterar foto" : "Adicionar foto"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      )}

      {!disabled && (
        <p className="text-center text-xs text-muted-foreground">
          Arraste uma imagem aqui ou clique. JPG, PNG ou WEBP até 5 MB.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <CropDialog
        source={source}
        onCancel={closeCrop}
        onConfirm={async (blob) => {
          closeCrop();
          await upload(blob);
        }}
      />
    </div>
  );
}

function CropDialog({
  source,
  onCancel,
  onConfirm,
}: {
  source: { url: string; el: HTMLImageElement } | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [source?.url]);

  if (!source) return null;

  const { el } = source;
  const base = VIEW / Math.min(el.naturalWidth, el.naturalHeight);
  const scale = base * zoom;
  const dispW = el.naturalWidth * scale;
  const dispH = el.naturalHeight * scale;

  const clamp = (x: number, y: number) => ({
    x: Math.max(-(dispW - VIEW) / 2, Math.min((dispW - VIEW) / 2, x)),
    y: Math.max(-(dispH - VIEW) / 2, Math.min((dispH - VIEW) / 2, y)),
  });

  const confirm = async () => {
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.imageSmoothingQuality = "high";

      const side = VIEW / scale;
      const cx = el.naturalWidth / 2 - offset.x / scale;
      const cy = el.naturalHeight / 2 - offset.y / scale;
      ctx.drawImage(
        el,
        cx - side / 2,
        cy - side / 2,
        side,
        side,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Falha ao processar a imagem");
      await onConfirm(blob);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar a imagem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>Arraste para centralizar e use o zoom. A foto final é quadrada.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-full bg-muted ring-1 ring-border touch-none"
            style={{ width: VIEW, height: VIEW, maxWidth: "100%" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOffset(
                clamp(
                  drag.current.ox + (e.clientX - drag.current.x),
                  drag.current.oy + (e.clientY - drag.current.y),
                ),
              );
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <img
              src={source.url}
              alt="Pré-visualização"
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={([z]) => {
                setZoom(z);
                setOffset((o) => o);
              }}
              aria-label="Zoom"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Salvar foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
