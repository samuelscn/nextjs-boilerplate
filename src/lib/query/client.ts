import { QueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/http/error";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, gcTime: 300_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof HttpError && error.status < 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
}
