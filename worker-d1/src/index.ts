import { timingSafeEqual } from "node:crypto";

type BlogPost = {
  id: string;
  title: string;
  summary: string;
  content: string[];
  published_at: string;
};

type FeaturedPost = {
  post_id: string;
  score: number;
  label: string;
  reason: string;
};

type ResetRequestSnapshot = {
  cycle_id: string;
  since: string;
  count: number;
};

type BlogData = {
  site: { title: string; description: string };
  posts: BlogPost[];
  stats: {
    total: number;
    last_published_at: string;
    days_since_last: number;
    avg_interval_days: number;
  };
  featured?: FeaturedPost | null;
  reactions?: ResetRequestSnapshot | null;
  ui: Record<string, string>;
};

type ContentRow = { content_json: string; version: number; updated_at: string };
type ResetRequestRow = { cycle_id: string; since: string; count: number };

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(JSON_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validateContent(value: unknown): value is BlogData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BlogData>;
  if (!candidate.site || typeof candidate.site.title !== "string" || typeof candidate.site.description !== "string") return false;
  if (!candidate.ui || typeof candidate.ui !== "object") return false;
  if (!Array.isArray(candidate.posts) || candidate.posts.length > 500) return false;
  if (!candidate.stats || !Number.isInteger(candidate.stats.total) || !validDate(candidate.stats.last_published_at)) return false;
  return candidate.posts.every((post) =>
    post && typeof post.id === "string" && post.id.length <= 100 &&
    typeof post.title === "string" && post.title.length <= 200 &&
    typeof post.summary === "string" && post.summary.length <= 1_000 &&
    Array.isArray(post.content) && post.content.length <= 100 &&
    post.content.every((paragraph) => typeof paragraph === "string" && paragraph.length <= 10_000) &&
    validDate(post.published_at)
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

async function defaultContent(request: Request, env: Env): Promise<BlogData> {
  const url = new URL("/content.json", request.url);
  const response = await env.ASSETS.fetch(url);
  if (!response.ok) throw new Error("默认内容资源不可用。");
  const content: unknown = await response.json();
  if (!validateContent(content)) throw new Error("默认内容资源无效。");
  return content;
}

async function resolvedContent(request: Request, env: Env): Promise<{ content: BlogData; row: ContentRow | null }> {
  const row = await readContent(env);
  if (row) {
    try {
      const content: unknown = JSON.parse(row.content_json);
      if (validateContent(content)) return { content, row };
    } catch {
      // The bundled configuration below remains available if an edit was invalid.
    }
  }
  return { content: await defaultContent(request, env), row };
}

async function handlePublicContent(request: Request, env: Env): Promise<Response> {
  const { content, row } = await resolvedContent(request, env);
  const snapshot = await readResetRequests(env);
  return json({ ...content, reactions: snapshot ?? content.reactions ?? null }, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      etag: `W/\"content-${row?.version ?? 0}\"`,
    },
  });
}

async function handleAdminRead(request: Request, env: Env): Promise<Response> {
  if (!await authorized(request, env)) {
    return json({ error: "管理员令牌不正确。" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  }
  const { content, row } = await resolvedContent(request, env);
  return json({ content, version: row?.version ?? 0, updatedAt: row?.updated_at ?? null }, {
    headers: { "cache-control": "no-store" },
  });
}

async function handleAdminWrite(request: Request, env: Env): Promise<Response> {
  if (!await authorized(request, env)) {
    return json({ error: "管理员令牌不正确。" }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 512_000) return json({ error: "请求内容过大。" }, { status: 413 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "请求内容必须是有效的 JSON。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return json({ error: "请求无效。" }, { status: 400 });
  const candidate = body as { content?: unknown; expectedVersion?: unknown };
  if (!Number.isInteger(candidate.expectedVersion) || !validateContent(candidate.content)) {
    return json({ error: "需要有效的博客 JSON 和 expectedVersion。" }, { status: 422 });
  }

  const result = await env.DB.prepare(
    `UPDATE site_content
     SET content_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1 AND version = ?`,
  ).bind(JSON.stringify(candidate.content), candidate.expectedVersion).run();
  if (result.meta.changes !== 1) {
    return json({ error: "内容在加载后已被修改，请重新加载后再试。" }, { status: 409 });
  }
  const saved = await readContent(env);
  return json({ ok: true, version: saved?.version, updatedAt: saved?.updated_at }, {
    headers: { "cache-control": "no-store" },
  });
}

async function readResetRequests(env: Env): Promise<ResetRequestSnapshot | null> {
  return env.DB.prepare(
    "SELECT cycle_id, since, count FROM reset_request_state WHERE id = 1",
  ).first<ResetRequestRow>();
}

async function handleResetRequests(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const snapshot = await readResetRequests(env);
    return snapshot ? json(snapshot, { headers: { "cache-control": "no-store" } }) : json({ error: "尚未初始化" }, { status: 503 });
  }
  if (request.method !== "POST") return json({ error: "不允许使用此请求方法" }, { status: 405, headers: { allow: "GET, POST" } });
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "JSON 无效" }, { status: 400 }); }
  const input = body as { n?: unknown; request_id?: unknown };
  const increment = Number(input?.n);
  if (!Number.isInteger(increment) || increment < 1 || increment > 25) return json({ error: "n 必须是 1 到 25 之间的整数" }, { status: 422 });
  const snapshot = await env.DB.prepare(
    "UPDATE reset_request_state SET count = count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING cycle_id, since, count",
  ).bind(increment).first<ResetRequestRow>();
  if (!snapshot) return json({ error: "尚未初始化" }, { status: 503 });
  return json({ ...snapshot, request_id: typeof input.request_id === "string" ? input.request_id : null });
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if ((pathname === "/api/posts" || pathname === "/api/content") && request.method === "GET") return handlePublicContent(request, env);
  if (pathname === "/api/reactions") return handleResetRequests(request, env);
  if (pathname === "/api/admin/content" && request.method === "GET") return handleAdminRead(request, env);
  if (pathname === "/api/admin/content" && request.method === "PUT") return handleAdminWrite(request, env);
  if (pathname.startsWith("/api/")) return json({ error: "接口不存在" }, { status: 404 });
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
      return json({ error: "服务器内部错误" }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
