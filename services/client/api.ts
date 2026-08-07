"use client";

import type { ApiResponse } from "@/types/domain";

/**
 * Error de API que conserva el código devuelto por el servidor.
 *
 * Extiende Error, así que todo el código existente que hace
 * `caught instanceof Error` y lee `.message` sigue funcionando igual. El código
 * permite que la interfaz reaccione al motivo concreto (por ejemplo, refrescar
 * la disponibilidad cuando el horario acaba de ocuparse) en lugar de limitarse
 * a mostrar un texto.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function clientApi<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(path, {
    ...init,
    headers: isFormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        }
  });

  const text = await response.text();
  let payload: ApiResponse<T>;
  try {
    payload = text ? (JSON.parse(text) as ApiResponse<T>) : { ok: response.ok, data: undefined as T };
  } catch {
    payload = {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: response.ok
          ? "El servidor respondió sin datos válidos. Intenta actualizar la página."
          : `Respuesta inválida del servidor (${response.status}).`
      }
    };
  }

  if (!response.ok || !payload.ok) {
    throw new ApiError(
      payload.error?.message ?? "No fue posible completar la acción.",
      payload.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return payload.data as T;
}

export type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
  success: boolean;
};
