type ContentRow = {
  content_json: string;
  version: number;
  updated_at: string;
};

type ContentDocument = {
  site: { name: string; eyebrow?: string; description?: string; theme?: string };
  hero: { label?: string; timestamp: string; message?: string; sourceLabel?: string; sourceUrl?: string };
  stats: Array<{ label: string; value: string; tone?: string }>;
  updates: Array<{ id: string; timestamp: string; title: string; text: string; url?: string }>;
  footer?: { note?: string; credit?: string };
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(JSON_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function validateContent(value: unknown): value is ContentDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ContentDocument>;
  if (!candidate.site || typeof candidate.site.name !== "string" || candidate.site.name.length > 120) return false;
  if (!candidate.hero || typeof candidate.hero.timestamp !== "string" || Number.isNaN(Date.parse(candidate.hero.timestamp))) return false;
  if (!Array.isArray(candidate.stats) || candidate.stats.length > 12) return false;
  if (!Array.isArray(candidate.updates) || candidate.updates.length > 200) return false;
  return candidate.stats.every((item) =>
    item && typeof item.label === "string" && item.label.length <= 80 && typeof item.value === "string" && item.value.length <= 40
  ) && candidate.updates.every((item) =>
    item && typeof item.id === "string" && item.id.length <= 100 && typeof item.title === "string" && item.title.length <= 160 &&
    typeof item.text === "string" && item.text.length <= 4_000 && typeof item.timestamp === "string" && !Number.isNaN(Date.parse(item.timestamp))
  );
}

async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(providedHash), new Uint8Array(expectedHash));
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return secretMatches(token, env.ADMIN_TOKEN);
}

async function readContent(env: Env): Promise<ContentRow | null> {
  return env.DB.prepare(
    "SELECT content_json, version, updated_at FROM site_content WHERE id = 1",
  ).first<ContentRow>();
}

async function handlePublicContent(env: Env): Promise<Response> {
  const row = await readContent(env);
  if (!row) return json({ error: "Content has not been initialized." }, { status: 503 });
  return json(JSON.parse(row.content_json), {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      etag: `W/\"content-${row.version}\"`,
    },
  });
}

async function handleAdminRead(request: Request, env: Env): Promise<Response> {
  if (!await authorized(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  }
  const row = await readContent(env);
  if (!row) return json({ error: "Content has not been initialized." }, { status: 503 });
  return json({ content: JSON.parse(row.content_json), version: row.version, updatedAt: row.updated_at }, {
    headers: { "cache-control": "no-store" },
  });
}

async function handleAdminWrite(request: Request, env: Env): Promise<Response> {
  if (!await authorized(request, env)) {
    return json({ error: "Unauthorized" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 256_000) return json({ error: "Request body is too large." }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid request." }, { status: 400 });
  const candidate = body as { content?: unknown; expectedVersion?: unknown };
  if (!Number.isInteger(candidate.expectedVersion) || !validateContent(candidate.content)) {
    return json({ error: "Invalid content or expectedVersion." }, { status: 422 });
  }

  const result = await env.DB.prepare(
    `UPDATE site_content
     SET content_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1 AND version = ?`,
  ).bind(JSON.stringify(candidate.content), candidate.expectedVersion).run();

  if (result.meta.changes !== 1) {
    return json({ error: "Content changed since it was loaded. Reload and try again." }, { status: 409 });
  }
  const saved = await readContent(env);
  return json({ ok: true, version: saved?.version, updatedAt: saved?.updated_at }, {
    headers: { "cache-control": "no-store" },
  });
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/content" && request.method === "GET") return handlePublicContent(env);
  if (pathname === "/api/admin/content" && request.method === "GET") return handleAdminRead(request, env);
  if (pathname === "/api/admin/content" && request.method === "PUT") return handleAdminWrite(request, env);
  if (pathname.startsWith("/api/")) {
    return json({ error: "Not found" }, { status: 404, headers: { allow: "GET, PUT" } });
  }
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: "request failed",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: "Internal server error" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
import { timingSafeEqual } from "node:crypto";

