type ApiErrorBody = {
  message?: string;
  detail?: string | null;
  errors?: unknown;
};

export function apiErrorMessage(body: ApiErrorBody | null | undefined, fallback = 'Terjadi kesalahan'): string {
  if (Array.isArray(body?.errors)) {
    const errors = body.errors
      .map((error) => String(error).trim())
      .filter(Boolean);
    if (errors.length > 0) return errors.join(', ');
  }

  if (body?.detail && body.detail.trim()) return body.detail;
  if (body?.message && body.message.trim()) return body.message;
  return fallback;
}

export async function readApiError(response: Response, fallback = 'Terjadi kesalahan'): Promise<string> {
  const body = await response.json().catch(() => null);
  return apiErrorMessage(body, fallback);
}
