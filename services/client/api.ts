"use client";

import type { ApiResponse } from "@/types/domain";

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
    throw new Error(payload.error?.message ?? "No fue posible completar la acción.");
  }

  return payload.data as T;
}

export type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
  success: boolean;
};
