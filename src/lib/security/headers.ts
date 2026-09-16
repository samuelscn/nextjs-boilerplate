export function securityHeaders(nonce: string, production: boolean, identityOrigin?: string): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'nonce-" + nonce + "' 'strict-dynamic'" + (production ? "" : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'" + (identityOrigin ? " " + identityOrigin : ""),
      "frame-ancestors 'none'",
      ...(production ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    // Native same-origin POST forms need a real Origin for CSRF validation.
    // no-referrer turns it into "null"; same-origin still hides external referrers.
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ...(production ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  };
}
