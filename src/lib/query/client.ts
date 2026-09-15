import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError } from "@/lib/http/api-error";

export function shouldRetryQuery(count: number, error: unknown): boolean {
  if (count >= 1) return false;
  if (error instanceof NetworkError) return true;
  // 429 is never retried automatically; callers may use retryAfterMs for explicit UX.
  return error instanceof ApiError && [500, 502, 503, 504].includes(error.statusCode);
}
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  });
}
