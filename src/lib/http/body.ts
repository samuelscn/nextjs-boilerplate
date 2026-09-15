export async function readBodyJson(response: Response, maxBytes = 1024 * 1024): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!contentType || !(contentType.endsWith("/json") || contentType.endsWith("+json"))) {
    await response.body?.cancel(); throw new Error("Invalid JSON content type");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new Error("Body limit");
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
