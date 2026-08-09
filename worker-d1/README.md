# Cloudflare Worker + D1

无前端框架的 Codex Resets 复刻。前台通过 `/api/resets` 读取 D1，后台位于 `/admin/`，使用 `ADMIN_TOKEN` Bearer Token 鉴权。

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，换成长随机令牌
npm run db:local
npm run dev
```

- 前台：<http://localhost:8787>
- 后台：<http://localhost:8787/admin/>

## 首次部署

1. 登录并创建 D1：

   ```bash
   npx wrangler login
   npx wrangler d1 create reset-tracker-db
   ```

2. 将命令返回的 `database_id` 填入 `wrangler.jsonc`。

3. 设置后台令牌并应用远程迁移：

   ```bash
   npx wrangler secret put ADMIN_TOKEN
   npm run db:remote
   ```

4. 验证并部署：

   ```bash
   npm run check
   npm run deploy
   ```

## API

- `GET /api/resets`：公开的事件、统计、Reset Watch 和 beg 计数，缓存 60 秒。
- `GET /api/reset-requests`：当前 beg 计数。
- `POST /api/reset-requests`：增加 beg 计数。
- `GET /api/sponsors`：赞助位展示配置。
- `GET /api/admin/content`：读取内容和版本，需要 `Authorization: Bearer <ADMIN_TOKEN>`。
- `PUT /api/admin/content`：校验并更新内容，需要携带 `content` 和 `expectedVersion`。

`expectedVersion` 用于避免两个后台页面互相覆盖：版本不一致时返回 HTTP 409，重新载入后再编辑即可。
