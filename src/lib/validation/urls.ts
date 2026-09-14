const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function safeServiceUrl(value: string, allowHttp = false): boolean {
  try {
    const url = new URL(value);
    return !/[\s\\*]/u.test(value) && !url.username && !url.password && !url.hash &&
      (url.protocol === "https:" || (allowHttp && url.protocol === "http:" && loopback.has(url.hostname)));
  } catch { return false; }
}

// Deliberately conservative: no encoded path separators, dot segments or control characters.
export function internalReturnPath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if ([...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return fallback;
  const pathname = value.split("?")[0] ?? "";
  if (/[\\\s#]/u.test(value) || /%/u.test(pathname) || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/iu.test(value)) return fallback;
  if (pathname.split("/").some(segment => segment === "." || segment === "..") ||
      /^\/(?:auth|api|_next)(?:\/|$)/u.test(pathname)) return fallback;
  return value;
}

export function productUrl(base: string, path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 2048 ||
      !/^\/[a-zA-Z0-9/_-]*$/u.test(path) || path.includes("//")) {
    throw new Error("Invalid Product API path");
  }
  const url = new URL(base);
  if (url.search || url.hash || url.username || url.password || !["https:", "http:"].includes(url.protocol)) throw new Error("Invalid Product API base");
  url.pathname = url.pathname.replace(/\/$/u, "") + path;
  return url;
}
