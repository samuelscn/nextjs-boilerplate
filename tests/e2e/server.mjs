// Test-only TLS ingress and discovery boundary. Does not implement an Identity protocol.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer as httpsServer } from "node:https";
import { request as httpRequest, get } from "node:http";

const directory = await mkdtemp(join(tmpdir(), "ginga-e2e-tls-"));
const certFile = join(directory, "cert.pem");
const keyFile = join(directory, "key.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", certFile,
  "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
const tls = { cert: await readFile(certFile), key: await readFile(keyFile) };
const processes = [];
const servers = [];
let closing = false;
async function close() {
  if (closing) return; closing = true;
  for (const child of processes) child.kill("SIGTERM");
  for (const server of servers) server.close();
  await Promise.all(processes.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(resolve => child.once("exit", resolve))));
  await rm(directory, { recursive: true, force: true });
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { void close().then(() => process.exit(0)); });
process.on("uncaughtException", () => { void close().then(() => process.exit(1)); });
const issuer = "https://localhost:4443/api/auth";
const discovery = httpsServer(tls, (request, response) => {
  const url = new URL(request.url, issuer);
  if (url.pathname === "/api/auth/.well-known/openid-configuration") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      issuer, authorization_endpoint: issuer + "/oauth2/authorize",
      token_endpoint: issuer + "/oauth2/token", jwks_uri: issuer + "/jwks",
      code_challenge_methods_supported: ["S256"], response_types_supported: ["code"],
      subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      authorization_response_iss_parameter_supported: true,
    }));
  } else if (url.pathname === "/api/auth/oauth2/authorize") {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><html lang='pt-BR'><title>Identity boundary</title><h1>Identity boundary</h1></html>");
  } else { response.writeHead(404); response.end(); }
});
await new Promise(resolve => discovery.listen(4443, "localhost", resolve));
servers.push(discovery);

function ready(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 40_000;
    const attempt = () => {
      const req = get("http://localhost:" + port + "/api/health", response => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(1000, () => req.destroy());
    };
    const retry = () => Date.now() > deadline ? reject(new Error("Production server not ready")) : setTimeout(attempt, 200);
    attempt();
  });
}
for (const [index, kind] of ["public", "app", "backoffice"].entries()) {
  const internal = 3400 + index;
  const external = 3440 + index;
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(OIDC_|SESSION_|PRODUCT_API_|APP_|I18N_)/u.test(key)) delete env[key];
  Object.assign(env, { NODE_ENV: "production", APP_KIND: kind, APP_URL: "https://localhost:" + external,
    APP_NAME: "Ginga Application", NEXT_TELEMETRY_DISABLED: "1", NODE_EXTRA_CA_CERTS: certFile });
  if (kind !== "public") Object.assign(env, {
    OIDC_ISSUER: issuer, OIDC_CLIENT_ID: "e2e-client", OIDC_CLIENT_SECRET: "test-only-e2e-secret",
    OIDC_AUDIENCE: "https://localhost:5443", OIDC_ALLOW_HTTP: "false", SESSION_SINGLE_PROCESS: "true",
  });
  const child = spawn(process.execPath, [".next/standalone/server.js"],
    // NextURL normalizes loopback IPs to localhost; match it so rewrites stay internal.
    { env: { ...env, PORT: String(internal), HOSTNAME: "localhost" }, stdio: ["ignore", "ignore", "inherit"] });
  processes.push(child);
  child.on("exit", code => { if (!closing && code !== 0) void close().then(() => process.exit(1)); });
  await ready(internal);
  const ingress = httpsServer(tls, (request, response) => {
    const upstream = httpRequest({ host: "localhost", port: internal, path: request.url, method: request.method,
      headers: { ...request.headers, host: "localhost:" + external, "x-forwarded-proto": "https" } }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response);
    });
    upstream.on("error", () => { response.writeHead(502); response.end(); });
    request.pipe(upstream);
  });
  await new Promise(resolve => ingress.listen(external, "localhost", resolve));
  servers.push(ingress);
}
console.log("Production fixtures ready: public, app, backoffice");
