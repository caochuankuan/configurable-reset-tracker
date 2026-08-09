const login = document.querySelector("#login");
const editor = document.querySelector("#editor");
const form = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const loginStatus = document.querySelector("#login-status");
const resetForm = document.querySelector("#reset-form");
const newPasswordInput = document.querySelector("#new-password");
const confirmPasswordInput = document.querySelector("#confirm-password");
const visualEditor = document.querySelector("#visual-editor");
const textarea = document.querySelector("#content");
const status = document.querySelector("#status");
const meta = document.querySelector("#meta");
let credentials = "";
let version = 0;
let content = null;

const field = (label, value, name, type = "text") => type === "textarea"
  ? `<label>${label}<textarea data-field="${name}" rows="4">${escapeHtml(value ?? "")}</textarea></label>`
  : `<label>${label}<input data-field="${name}" type="${type}" value="${escapeHtml(type === "datetime-local" ? toLocalDateTime(value) : value ?? "")}"></label>`;
function toLocalDateTime(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[char])); }

async function api(method = "GET", body) {
  const response = await fetch("/api/admin/content", {
    method,
    headers: { authorization: `Basic ${credentials}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function renderEditor() {
  const contacts = content.site.contacts || {};
  visualEditor.innerHTML = `
    <section class="editor-section"><h3>网站信息</h3><div class="form-grid">${field("网站标题", content.site.title, "site.title")}${field("网站描述", content.site.description, "site.description")}</div></section>
    <section class="editor-section"><h3>联系方式</h3><div class="form-grid contact-grid">${["github", "qq", "email"].map((key) => `<div class="contact-card"><strong>${key === "github" ? "GitHub" : key === "qq" ? "QQ" : "邮箱"}</strong>${field("显示名称", contacts[key]?.label, `contact.${key}.label`)}${field("账号或地址", contacts[key]?.value, `contact.${key}.value`)}${field("链接", contacts[key]?.url, `contact.${key}.url`)}</div>`).join("")}</div></section>
    <section class="editor-section"><h3>精选文章</h3><div class="form-grid">${field("文章 ID", content.featured?.post_id, "featured.post_id")}${field("推荐分数", content.featured?.score, "featured.score", "number")}${field("标签", content.featured?.label, "featured.label")}</div>${field("推荐理由", content.featured?.reason, "featured.reason")}</section>
    <section class="editor-section"><div class="section-heading"><h3>文章列表</h3><span>${content.posts.length} 篇</span></div><div id="posts-list">${content.posts.map((post, index) => `<article class="post-editor" data-post-index="${index}"><div class="post-heading"><h4>文章 ${index + 1}</h4><button type="button" class="remove-post secondary">删除</button></div>${field("文章 ID", post.id, "id")}${field("标题", post.title, "title")}${field("摘要", post.summary, "summary")}<div class="form-grid">${field("发布时间", post.published_at, "published_at", "datetime-local")}${field("正文（每行一段）", (post.content || []).join("\\n"), "content", "textarea")}</div></article>`).join("")}</div><button type="button" id="add-post" class="secondary">＋新增文章</button></section>`;
  visualEditor.querySelectorAll('input, textarea').forEach((input) => input.addEventListener("input", syncContent));
  visualEditor.querySelectorAll(".remove-post").forEach((button) => button.addEventListener("click", () => { button.closest(".post-editor").remove(); syncContent(); }));
  visualEditor.querySelector("#add-post").addEventListener("click", () => { content.posts.push({ id: `new-post-${Date.now()}`, title: "新文章", summary: "文章摘要", content: ["正文内容"], published_at: new Date().toISOString() }); renderEditor(); syncContent(); });
  syncContent();
}

function readValue(selector, fallback = "") { return visualEditor.querySelector(selector)?.value ?? fallback; }
function syncContent() {
  if (!content) return;
  content.site.title = readValue('[data-field="site.title"]', content.site.title);
  content.site.description = readValue('[data-field="site.description"]', content.site.description);
  for (const key of ["github", "qq", "email"]) for (const part of ["label", "value", "url"]) content.site.contacts[key][part] = readValue(`[data-field="contact.${key}.${part}"]`, content.site.contacts[key][part]);
  content.featured = { ...(content.featured || {}), post_id: readValue('[data-field="featured.post_id"]'), score: Number(readValue('[data-field="featured.score"]', 0)), label: readValue('[data-field="featured.label"]'), reason: readValue('[data-field="featured.reason"]') };
  content.posts = [...visualEditor.querySelectorAll(".post-editor")].map((article, index) => { const date = new Date(readValueIn(article, "published_at")); return { id: readValueIn(article, "id"), title: readValueIn(article, "title"), summary: readValueIn(article, "summary"), published_at: Number.isNaN(date.valueOf()) ? content.posts[index]?.published_at || new Date().toISOString() : date.toISOString(), content: readValueIn(article, "content").split(/\n+/).map((line) => line.trim()).filter(Boolean) }; });
  textarea.value = JSON.stringify(content, null, 2);
}
function readValueIn(parent, name) { return parent.querySelector(`[data-field="${name}"]`)?.value ?? ""; }

async function load() {
  status.textContent = "加载中…";
  const result = await api();
  version = result.version;
  content = structuredClone(result.content);
  renderEditor();
  meta.textContent = `版本 ${version} · 更新时间 ${result.updatedAt || "尚未保存"}`;
  login.hidden = true;
  editor.hidden = false;
  status.textContent = "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  credentials = btoa(`${usernameInput.value.trim()}:${passwordInput.value}`);
  loginStatus.textContent = "登录中…";
  try { await load(); loginStatus.textContent = ""; } catch (error) { if (error?.message === "首次登录必须修改密码。") { resetForm.hidden = false; loginStatus.textContent = "请先修改初始密码。"; } else { credentials = ""; loginStatus.textContent = error instanceof Error ? error.message : String(error); } }
});
resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (newPasswordInput.value !== confirmPasswordInput.value) { loginStatus.textContent = "两次输入的密码不一致。"; return; }
  try {
    const response = await fetch("/api/admin/password", { method: "PUT", headers: { authorization: `Basic ${credentials}`, "content-type": "application/json" }, body: JSON.stringify({ newPassword: newPasswordInput.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    passwordInput.value = newPasswordInput.value;
    credentials = btoa(`${usernameInput.value.trim()}:${passwordInput.value}`);
    resetForm.hidden = true;
    await load();
  } catch (error) { loginStatus.textContent = error instanceof Error ? error.message : String(error); }
});
document.querySelector("#reload").addEventListener("click", () => load().catch((error) => { status.textContent = error.message; }));
document.querySelector("#logout").addEventListener("click", () => { credentials = ""; content = null; editor.hidden = true; login.hidden = false; passwordInput.value = ""; });
document.querySelector("#save").addEventListener("click", async () => {
  syncContent();
  status.textContent = "校验并保存中…";
  try { const result = await api("PUT", { content, expectedVersion: version }); version = result.version; meta.textContent = `版本 ${version} · 更新时间 ${result.updatedAt}`; status.textContent = "已保存，公开页面将在 60 秒内更新。"; }
  catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});
