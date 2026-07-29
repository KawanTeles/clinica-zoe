import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History } from "lucide-react";
import { NotificacoesTimeline } from "./NotificacoesTimeline";

type Props = {
  nome: string;
  pacienteId?: string;
  profissionalId?: string;
};

/** Histórico de mensagens enviadas relacionadas às consultas da pessoa. */
export function HistoricoNotificacoesDialog({ nome, pacienteId, profissionalId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs">
          <History className="mr-1 h-3.5 w-3.5" /> Histórico de mensagens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagens de {nome}</DialogTitle>
        </DialogHeader>
        {open && (
          <NotificacoesTimeline pacienteId={pacienteId} profissionalId={profissionalId} limit={40} />
        )}
      </DialogContent>
    </Dialog>
  );
}
