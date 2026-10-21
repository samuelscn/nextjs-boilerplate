import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./config/env");
    const env = getEnv();
    const { initErrorTracking } = await import("./server/error-tracking");
    initErrorTracking(env);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./server/error-tracking");
  await reportRequestError(...args);
};
