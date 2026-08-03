-- Financeiro — Fase 1 (Fundação): novo valor de status "PARCIAL".
--
-- Separado em sua própria migração porque `ALTER TYPE ... ADD VALUE` não
-- pode ter o valor novo referenciado (comparado/armazenado) na MESMA
-- transação em que foi adicionado. A migração seguinte
-- (20260803160100_financeiro_contas_a_receber.sql) já pode usar 'PARCIAL'
-- livremente, pois roda em uma transação separada.
--
-- Aditiva e retrocompatível: todo código que só conhecia
-- ABERTO/PAGO/CANCELADO continua funcionando sem alteração.

ALTER TYPE public.financeiro_status ADD VALUE IF NOT EXISTS 'PARCIAL';
