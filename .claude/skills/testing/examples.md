# Exemplos — testing

## 1. Candidatos naturais a teste unitário (funções puras)

`src/lib/agenda-utils.ts`:

```ts
export function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
```

Um teste Vitest hipotético (não existente no projeto ainda):

```ts
import { describe, it, expect } from "vitest";
import { addMinutes } from "@/lib/agenda-utils";

describe("addMinutes", () => {
  it("soma minutos dentro do mesmo dia", () => {
    expect(addMinutes("09:00", 60)).toBe("10:00");
  });
  it("dá a volta na meia-noite", () => {
    expect(addMinutes("23:30", 45)).toBe("00:15");
  });
});
```

## 2. Roteiro de verificação manual do ciclo de agendamento

Sem suite automatizada, o roteiro mínimo para validar uma mudança que toca
`agendamentos`:

1. Login como `CLIENTE` → `/agendamento` → criar consulta com profissional
   ativo → confirma `status = PENDENTE` criado.
2. Tentar criar um segundo agendamento no mesmo horário/profissional →
   confirma que a UI mostra o erro do trigger
   (`"Conflito de horário..."`).
3. Login como `RECEPCIONISTA`/`ADMIN` → `/app/solicitacoes` → aprovar →
   confirma em `/app/financeiro` que um lançamento `ABERTO` foi criado com
   o mesmo valor congelado.
4. Cancelar o agendamento aprovado → confirma que o lançamento financeiro
   virou `CANCELADO` automaticamente.
5. Login como `PROFISSIONAL` vinculado → confirma que ele vê o agendamento
   em `/app/minha-agenda` e o paciente em `/app/meus-pacientes`.
6. Login como outro `PROFISSIONAL` não vinculado → confirma que ele **não**
   vê nem o agendamento nem o paciente.

## 3. Onde ficaria a config de Vitest (se adicionada)

Adição hipotética a `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

Vitest reaproveita a config do Vite já existente (`vite.config.ts`), sem
exigir bundler paralelo.
