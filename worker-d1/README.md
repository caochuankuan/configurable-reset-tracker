# Cloudflare Worker + D1

无前端框架的中文博客。前台通过 `/api/posts` 读取 D1，后台位于 `/admin/`，使用 `ADMIN_TOKEN` Bearer Token 鉴权。文章标题、摘要、正文、发布时间和页面文案均由 JSON 配置。

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

- `GET /api/posts`：公开的文章、精选内容、统计和催更计数，缓存 60 秒。
- `GET /api/reactions`：当前催更计数。
- `POST /api/reactions`：增加催更计数。
- `GET /api/admin/content`：读取内容和版本，需要 `Authorization: Bearer <ADMIN_TOKEN>`。
- `PUT /api/admin/content`：校验并更新内容，需要携带 `content` 和 `expectedVersion`。

`expectedVersion` 用于避免两个后台页面互相覆盖：版本不一致时返回 HTTP 409，重新载入后再编辑即可。
