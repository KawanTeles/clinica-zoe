/**
 * Meta WhatsApp Cloud API - Exponential Backoff Retry Handler
 * Executa retentativas automáticas (Retry 1, 2, 3) com backoff exponencial para erros temporários de API.
 */

import { parseMetaApiError, MetaParsedError } from "./errors";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  parsedError?: MetaParsedError;
  totalAttempts: number;
  duracaoTotalMs: number;
  attemptLogs: Array<{
    attempt: number;
    delayMs: number;
    duracaoMs: number;
    errorMsg?: string;
    parsedError?: MetaParsedError;
  }>;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Executa uma operação assíncrona com política de retentativa e backoff exponencial.
 */
export async function executeWithRetry<T>(
  fn: (attempt: number) => Promise<{ ok: boolean; status: number; raw?: any; error?: string; duracaoMs: number; data?: T }>,
  options?: RetryOptions
): Promise<RetryResult<T>> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 500;
  const backoffFactor = options?.backoffFactor ?? 2;

  const startTotal = Date.now();
  const attemptLogs: RetryResult<T>["attemptLogs"] = [];

  let currentAttempt = 0;
  let lastParsedError: MetaParsedError | undefined;

  while (currentAttempt <= maxRetries) {
    currentAttempt++;
    const attemptStart = Date.now();

    try {
      const res = await fn(currentAttempt);
      const attemptDuration = Date.now() - attemptStart;

      if (res.ok) {
        attemptLogs.push({
          attempt: currentAttempt,
          delayMs: 0,
          duracaoMs: attemptDuration,
        });
        return {
          success: true,
          data: res.data ?? (res.raw as T),
          totalAttempts: currentAttempt,
          duracaoTotalMs: Date.now() - startTotal,
          attemptLogs,
        };
      }

      // Analisa o erro retornado
      const parsedErr = parseMetaApiError(res.raw, res.status);
      lastParsedError = parsedErr;

      attemptLogs.push({
        attempt: currentAttempt,
        delayMs: 0,
        duracaoMs: attemptDuration,
        errorMsg: res.error || parsedErr.userMessage,
        parsedError: parsedErr,
      });

      console.warn(
        `[whatsapp:retry] Tentativa ${currentAttempt}/${maxRetries + 1} falhou. HTTP ${res.status} (Código Meta ${parsedErr.code}). Retryable: ${parsedErr.retryable}`
      );

      // Se o erro NÃO for retentável (ex: Allowed List 131030, Token expirado 190, Telefone sem WA 131026), aborta os retries
      if (!parsedErr.retryable) {
        console.warn(`[whatsapp:retry] Abortando retries para o erro não-retentável: ${parsedErr.technicalDiagnostic}`);
        break;
      }

      // Se ainda houver tentativas restantes, calcula delay exponencial
      if (currentAttempt <= maxRetries) {
        const delayMs = initialDelayMs * Math.pow(backoffFactor, currentAttempt - 1);
        console.log(`[whatsapp:retry] Aguardando ${delayMs}ms antes do Retry ${currentAttempt}...`);
        await sleep(delayMs);
      }
    } catch (catchedErr) {
      const attemptDuration = Date.now() - attemptStart;
      const catchedMessage = (catchedErr as Error).message;
      const parsedErr = parseMetaApiError({ error: { message: catchedMessage } }, 500);
      lastParsedError = parsedErr;

      attemptLogs.push({
        attempt: currentAttempt,
        delayMs: 0,
        duracaoMs: attemptDuration,
        errorMsg: catchedMessage,
        parsedError: parsedErr,
      });

      if (currentAttempt <= maxRetries) {
        const delayMs = initialDelayMs * Math.pow(backoffFactor, currentAttempt - 1);
        await sleep(delayMs);
      }
    }
  }

  return {
    success: false,
    parsedError: lastParsedError,
    totalAttempts: currentAttempt,
    duracaoTotalMs: Date.now() - startTotal,
    attemptLogs,
  };
}
