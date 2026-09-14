export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, public readonly requestId?: string) {
    super(code);
    this.name = "HttpError";
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError && error.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (error instanceof HttpError && error.status === 403) return "Acesso não permitido.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
