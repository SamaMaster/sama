const fs = await import("node:fs/promises");

const urls = [
  "https://mp.weixin.qq.com/s/_lygst1yCTFdbsZUXDi2Zw",
  "https://mp.weixin.qq.com/s/X31dvILjZ5BG6i9Mmt7rag",
  "https://mp.weixin.qq.com/s/LmaJjdZltHkaSHHF3vj9Bg",
  "https://mp.weixin.qq.com/s/kky1qX5eoYMF4nn5yc8ipA",
  "https://mp.weixin.qq.com/s/-nPs2UYpvmy-ryu_hg50tg",
];

const task = await taskSpace("微信公众号5篇文章访问验证");
const page = task.page("p1");
const results = [];

for (let index = 0; index < urls.length; index += 1) {
  const requestedUrl = urls[index];
  const startedAt = new Date().toISOString();
  let navigationError = null;
  try {
    await page.goto(requestedUrl, { timeout: 45000, waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.readyState === "interactive" || document.readyState === "complete",
      undefined,
      { timeout: 15000 },
    );
  } catch (error) {
    navigationError = String(error?.message ?? error);
  }

  const extracted = await page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const content = document.querySelector("#js_content");
    const bodyText = document.body?.innerText?.trim() ?? "";
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const interactionSelectors = [
      "#js_read_area3",
      "#js_like_area3",
      "#js_like_btn",
      "#js_reward_area",
      "#js_comment_area",
      ".rich_media_meta_list",
      ".rich_media_tool",
    ];
    const interactions = interactionSelectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter(visible)
        .map((node) => ({ selector, text: node.innerText?.trim() ?? "" }))
        .filter((item) => item.text),
    );
    const warningPatterns = [
      "环境异常",
      "访问过于频繁",
      "内容已被发布者删除",
      "该内容已被发布者删除",
      "此内容因违规无法查看",
      "参数错误",
      "请在微信客户端打开链接",
      "网络出错",
    ];
    return {
      finalUrl: location.href,
      documentTitle: document.title,
      title: text("#activity-name") || text(".rich_media_title"),
      author: text("#js_author_name") || text(".rich_media_meta_text"),
      account: text("#js_name") || text(".rich_media_meta_nickname"),
      publishTime: text("#publish_time") || text(".rich_media_meta_text.rich_media_meta_nickname + em"),
      ipWord: text("#js_ip_wording"),
      contentText: content?.innerText?.trim() ?? null,
      contentHtml: content?.innerHTML ?? null,
      contentExists: Boolean(content),
      contentTextLength: content?.innerText?.trim().length ?? 0,
      imageCount: content?.querySelectorAll("img").length ?? 0,
      bodyTextLength: bodyText.length,
      bodyTextSample: bodyText.slice(0, 1500),
      warnings: warningPatterns.filter((pattern) => bodyText.includes(pattern)),
      interactions,
      meta: {
        description: document.querySelector('meta[name="description"]')?.content ?? null,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
        ogDescription: document.querySelector('meta[property="og:description"]')?.content ?? null,
      },
    };
  });

  results.push({ index: index + 1, requestedUrl, startedAt, navigationError, ...extracted });
  console.log({
    index: index + 1,
    requestedUrl,
    finalUrl: extracted.finalUrl,
    title: extracted.title,
    contentTextLength: extracted.contentTextLength,
    warnings: extracted.warnings,
    navigationError,
  });
}

const outputPath = "C:/Users/Administrator/Documents/ChatGPT/熵 2/ego-wechat-5/raw-results.json";
await fs.writeFile(outputPath, JSON.stringify({ taskSpaceId: task.spaceId, capturedAt: new Date().toISOString(), results }, null, 2), "utf8");
console.log({ taskSpaceId: task.spaceId, outputPath, count: results.length });
