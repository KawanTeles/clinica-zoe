# Skill: documentation

## Objetivo

Manter a documentação do projeto (README, DEPLOYMENT, AGENTS, `.claude/`)
precisa e sincronizada com o código real, em português, no mesmo tom já
estabelecido — evitando que documentação e implementação divirjam.

## Quando utilizar

- Ao adicionar uma variável de ambiente, função SQL crítica, bucket de
  Storage ou passo de implantação novo — `DEPLOYMENT.md`/`README.md`
  precisam refletir isso.
- Ao criar ou alterar uma Skill em `.claude/skills/`.
- Ao adicionar um módulo/domínio novo ao sistema que mereça uma seção no
  `CLAUDE.md`.
- Ao perceber que a documentação existente descreve algo que não é mais
  verdade no código (drift).

## Boas práticas

- Documentação de produto/infraestrutura (`README.md`, `DEPLOYMENT.md`) é
  escrita em **português**, com checklists (`- [ ]`) para passos de
  implantação — siga esse formato para itens novos.
- Ao adicionar uma skill nova em `.claude/skills/`, siga a mesma estrutura
  de seções já usada (`Objetivo`, `Quando utilizar`, `Boas práticas`, `Más
  práticas`, `Fluxo recomendado`, `Checklist`, `Regras obrigatórias`,
  `Arquivos normalmente envolvidos`, `Erros comuns`, `Exemplos`,
  `Observações`) e um `examples.md` com trechos **reais** do código —
  nunca invente caminho de arquivo ou nome de função que não existe.
- Use `[[nome-da-skill]]` para referenciar outra skill relacionada (ver
  qualquer skill existente) — mantém a base de conhecimento navegável.
- Ao descrever uma funcionalidade que existe só como schema/preparação (ex.:
  integração WhatsApp Cloud API), seja explícito sobre o que está ativo
  hoje vs. o que é scaffolding — ver [[whatsapp]] e [[medical-records]]
  como exemplo desse cuidado.
- Comentários em código (quando necessários) seguem o tom já usado:
  curtos, explicando o "porquê" não óbvio, não o "o quê" (que o código já
  diz) — ver exemplos em `src/server.ts`
  (`// h3 swallows in-handler throws...`) e `dual-client.ts`.

## Más práticas

- Documentar uma feature como "implementada" quando só existe schema/tabela
  preparada, sem rota consumindo (ver o cuidado tomado em [[whatsapp]]).
- Escrever documentação genérica que serviria para qualquer projeto React —
  toda documentação deste projeto deve referenciar arquivos, tabelas e
  fluxos reais do Clínica Zoe.
- Deixar `README.md`/`DEPLOYMENT.md` divergirem silenciosamente do schema
  atual (ex.: `DEPLOYMENT.md` menciona "20 tabelas" — se uma tabela for
  adicionada/removida, esse número precisa ser atualizado).
- Criar documentação solta fora de `.claude/skills/` ou dos arquivos raiz já
  estabelecidos (`README.md`, `DEPLOYMENT.md`, `AGENTS.md`, `CLAUDE.md`) sem
  necessidade — evite fragmentar o conhecimento em muitos lugares novos.

## Fluxo recomendado

1. Ao terminar uma mudança de código, pergunte: "isso muda algo que a
   documentação existente afirma?" (variável de ambiente, passo de deploy,
   contagem de tabelas, comportamento de uma função crítica).
2. Atualize o arquivo de documentação mais específico primeiro
   (`DEPLOYMENT.md` para checklist de implantação, a skill de domínio
   correspondente para comportamento de código, `CLAUDE.md` só para regras
   estruturais amplas).
3. Se a mudança introduz um padrão novo reutilizável, considere se merece
   uma entrada em "Boas práticas"/"Exemplos" da skill relevante, em vez de
   só um comentário isolado no código.
4. Verifique que qualquer caminho de arquivo citado na documentação nova
   realmente existe no repositório.

## Checklist

- [ ] Toda referência a arquivo/função/tabela na documentação nova
      corresponde a algo que existe de fato no código?
- [ ] Documentação de feature distingue "implementado" de "preparado/
      planejado" quando aplicável?
- [ ] Nova skill segue a estrutura de seções padrão do projeto?
- [ ] `DEPLOYMENT.md`/`README.md` foram revisados se a mudança afeta
      implantação?

## Regras obrigatórias

- Nunca documentar como existente um arquivo, componente ou endpoint que
  não está no código-fonte atual — isso já causou confusão real neste
  projeto (README/DEPLOYMENT mencionam um endpoint
  `/api/public/test-whatsapp` que não existe em `src/routes/`; trate isso
  como um lembrete do risco, não repita o padrão).
- Documentação de domínio fica em `.claude/skills/<dominio>/`, documentação
  de infraestrutura/produto fica nos arquivos raiz — não misture os dois
  propósitos em um único arquivo novo.

## Arquivos normalmente envolvidos

- `README.md`, `DEPLOYMENT.md`, `AGENTS.md`
- `.claude/CLAUDE.md`, `.claude/skills/**`
- `src/routes/README.md` (documentação local da convenção de rotas)

## Erros comuns

- Atualizar o código mas esquecer o checklist correspondente em
  `DEPLOYMENT.md` (ex.: nova função SQL crítica que deveria estar na lista
  de "Funções validadas").
- Escrever uma skill nova sem `examples.md`, ou com exemplos genéricos que
  não usam trechos reais do projeto — vai contra o propósito de todo esse
  conjunto de skills.

## Exemplos

Ver `examples.md`.

## Observações

Este próprio conjunto de skills (`.claude/skills/`) é, em si, o principal
artefato de documentação viva do projeto — mantê-lo preciso tem retorno
direto na qualidade de qualquer sessão futura do Claude Code neste
repositório.
