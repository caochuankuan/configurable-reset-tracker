const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_POSTS = [
  {
    id: "demo-ai-workflow",
    title: "把 AI 编程助手真正接进工作流",
    summary: "让 AI 理解仓库、验证结果，并参与一次完整交付。",
    content: [
      "AI 编程助手不应该只是另一个聊天窗口。给它完整的仓库上下文、明确的约束和可以运行的验证流程，结果会稳定得多。",
      "真正节省时间的不是生成速度，而是减少返工。能够带着证据交付结果，才算真正进入开发工作流。"
    ],
    daysAgo: 2
  },
  {
    id: "demo-config-page",
    title: "配置驱动页面，为什么比想象中更实用",
    summary: "当内容和结构分开，更新站点就不再等于修改代码。",
    content: [
      "对于内容型页面，标题、摘要、正文和发布时间从 JSON 读取，就已经能解决大部分维护问题。",
      "页面负责展示，配置负责内容，后台负责安全修改。边界清楚之后，每一部分都更容易独立演进。"
    ],
    daysAgo: 9
  },
  {
    id: "demo-shipping",
    title: "为什么持续发布比一次做到完美更重要",
    summary: "作品会在真实反馈中成长，而不是在本地计划里变得完美。",
    content: [
      "持续发布建立的是反馈节奏。每个版本都足够完整，同时为下一次改进保留空间。",
      "完成并不意味着停止打磨，它只是让后续打磨拥有更明确的方向。"
    ],
    daysAgo: 18
  }
];

export function getDemoData() {
  const posts = DEMO_POSTS.map(({ daysAgo, ...post }) => ({
    ...post,
    published_at: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
  }));
  return {
    locale: "zh-CN",
    site: {
      title: "代码与思考",
      description: "记录 AI 编程、产品构建和独立开发中的真实经验。",
      contacts: {
        github: { label: "GitHub", value: "caochuankuan", url: "https://github.com/caochuankuan" },
        qq: { label: "QQ", value: "2835082172", url: "https://wpa.qq.com/msgrd?v=3&uin=2835082172&site=qq&menu=yes" },
        email: { label: "邮箱", value: "chuankuancao@gmail.com", url: "mailto:chuankuancao@gmail.com" },
      },
    },
    posts,
    featured: {
      post_id: posts[0].id,
      score: 92,
      label: "本周精选",
      reason: "从工具思维转向完整工作流，是提升 AI 编程质量最关键的一步。",
    },
    stats: {
      total: posts.length,
      last_published_at: posts[0].published_at,
      days_since_last: 2,
      avg_interval_days: 8,
    },
    reactions: {
      cycle_id: posts[0].id,
      since: posts[0].published_at,
      count: 128,
    },
    ui: {
      site_title: "代码与思考",
      site_description: "记录 AI 编程、产品构建和独立开发中的真实经验。",
      subscription_label: "联系方式",
      featured: "本周精选",
      recommendation_score: "读者推荐度",
      recommendation_reason: "推荐理由",
      published: "发布于",
      expand: "展开",
      time_since_last: "距上次更新",
      nudge: "催更",
      posts: "文章数量",
      average_interval: "平均更新间隔",
      longest_break: "最长停更",
      activity: "更新足迹",
      last_26_weeks: "最近 26 周",
      posted: "发布文章",
      quiet: "认真生活",
      latest_posts: "最新文章",
      archive_subtitle: "关于代码、产品与持续创造的记录",
      show_all: "显示全部文章",
      show_fewer: "收起文章",
      dialog_label: "文章",
      dialog_close: "关闭",
    },
    isDemo: true,
  };
}
