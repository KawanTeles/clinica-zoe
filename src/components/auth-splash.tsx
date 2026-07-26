import { HeartPulse } from "lucide-react";

interface AuthSplashProps {
  /** Texto principal exibido abaixo da marca */
  message?: string;
}

/**
 * Tela de carregamento premium exibida enquanto a sessão e os papéis
 * do usuário são resolvidos. Impede qualquer flicker entre áreas.
 */
export function AuthSplash({ message = "Preparando seu ambiente..." }: AuthSplashProps) {
  return (
    <div className="fixed inset-0 z-50 grid min-h-screen place-items-center bg-linear-to-br from-secondary via-background to-surface-muted px-6">
      <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-5 duration-500">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
          <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-elegant sm:h-20 sm:w-20">
            <HeartPulse className="h-7 w-7 sm:h-9 sm:w-9" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight sm:text-xl">Clínica Zoe</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="h-1 w-40 overflow-hidden rounded-full bg-primary/15 sm:w-56">
          <div className="h-full w-1/3 animate-[zoe-progress_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>

      <style>{`
        @keyframes zoe-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
