const fs = await import("node:fs/promises");

const sourcePath = "C:/Users/Administrator/.codex/attachments/0364b8ed-30df-404b-98e1-1c354fd6ab8f/已粘贴的文本.txt";
const outputPath = "C:/Users/Administrator/Documents/ChatGPT/熵 2/ego-wechat-5/raw-corpus.jsonl";
const taskName = "微信公众号138篇高阅读文章研究";

const source = await fs.readFile(sourcePath, "utf8");
const listedUrls = source.match(/https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+/g) ?? [];
const urls = [...new Set(listedUrls)];

let existing = "";
try {
  existing = await fs.readFile(outputPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const completedUrls = new Set(
  existing
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line).requestedUrl),
);

const entry = (await listTaskSpaces()).find((item) => item.name === taskName);
const task = !entry
  ? await taskSpace(taskName)
  : entry.ownership === "user"
    ? await claimTaskSpace(entry.id)
    : entry.ownership === "agentDelegatedToUser"
      ? await takeOverTaskSpace(entry.id)
      : await taskSpace(entry.id);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

console.log({
  taskSpaceId: task.spaceId,
  listedCount: listedUrls.length,
  uniqueCount: urls.length,
  alreadyCompleted: completedUrls.size,
  remaining: urls.filter((url) => !completedUrls.has(url)).length,
});

for (let index = 0; index < urls.length; index += 1) {
  const requestedUrl = urls[index];
  if (completedUrls.has(requestedUrl)) continue;

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

  let extracted;
  try {
    extracted = await page.evaluate(() => {
      const clean = (value) => value?.replace(/\s+/g, " ").trim() || null;
      const text = (selector) => clean(document.querySelector(selector)?.textContent);
      const metaPairs = [...document.querySelectorAll("meta")]
        .map((node) => ({
          key: node.getAttribute("property") || node.getAttribute("name") || node.getAttribute("itemprop"),
          content: node.getAttribute("content"),
        }))
        .filter((item) => item.key && item.content);
      const meta = Object.fromEntries(metaPairs.map((item) => [item.key, item.content]));
      const content = document.querySelector("#js_content");
      const bodyText = document.body?.innerText?.trim() ?? "";
      const contentText = content?.innerText?.trim() ?? null;
      const contentElements = content ? [...content.querySelectorAll("*")] : [];
      const paragraphTexts = content
        ? [...content.querySelectorAll("p")].map((node) => node.innerText?.trim() ?? "").filter(Boolean)
        : [];
      const sectionTexts = content
        ? [...content.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => node.innerText?.trim() ?? "").filter(Boolean)
        : [];
      const styles = contentElements.slice(0, 2500).map((node) => {
        const style = getComputedStyle(node);
        return {
          textAlign: style.textAlign,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
          backgroundColor: style.backgroundColor,
        };
      });
      const countBy = (values, key) => {
        const counts = new Map();
        for (const value of values) {
          const item = value[key];
          if (!item) continue;
          counts.set(item, (counts.get(item) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
      };
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
      const globalValue = (name) => {
        try {
          const value = window[name];
          return ["string", "number", "boolean"].includes(typeof value) ? value : null;
        } catch {
          return null;
        }
      };
      return {
        finalUrl: location.href,
        documentTitle: document.title || null,
        title: text("#activity-name") || text(".rich_media_title") || meta["og:title"] || globalValue("msg_title"),
        author: text("#js_author_name") || meta.author || meta["article:author"] || null,
        account: text("#js_name") || text(".rich_media_meta_nickname") || meta["og:article:author"] || meta["twitter:creator"] || null,
        publishTime: text("#publish_time") || null,
        modifyTime: text("#modify_time") || null,
        ipLocation: text("#js_ip_wording") || null,
        timestamp: globalValue("ct"),
        biz: globalValue("biz"),
        contentExists: Boolean(content),
        contentText,
        contentHtml: content?.innerHTML ?? null,
        contentTextLength: contentText?.length ?? 0,
        bodyTextLength: bodyText.length,
        bodyTextSample: bodyText.slice(0, 1200),
        warnings: warningPatterns.filter((pattern) => bodyText.includes(pattern)),
        layout: {
          imageCount: content?.querySelectorAll("img").length ?? 0,
          videoCount: content?.querySelectorAll("video,iframe.video_iframe").length ?? 0,
          paragraphCount: paragraphTexts.length,
          nonEmptyParagraphCount: paragraphTexts.length,
          averageParagraphChars: paragraphTexts.length
            ? Math.round(paragraphTexts.reduce((sum, value) => sum + value.length, 0) / paragraphTexts.length)
            : 0,
          maxParagraphChars: paragraphTexts.length ? Math.max(...paragraphTexts.map((value) => value.length)) : 0,
          headingCount: sectionTexts.length,
          headings: sectionTexts.slice(0, 50),
          strongCount: content?.querySelectorAll("strong,b").length ?? 0,
          linkCount: content?.querySelectorAll("a").length ?? 0,
          blockquoteCount: content?.querySelectorAll("blockquote").length ?? 0,
          centerAlignedElements: styles.filter((item) => item.textAlign === "center").length,
          rightAlignedElements: styles.filter((item) => item.textAlign === "right").length,
          fontSizes: countBy(styles, "fontSize"),
          fontWeights: countBy(styles, "fontWeight"),
          colors: countBy(styles, "color"),
          backgroundColors: countBy(styles, "backgroundColor"),
        },
        interactionText: [
          text("#js_read_area3"),
          text("#js_like_area3"),
          text("#js_reward_area"),
          text("#js_comment_area"),
          text(".rich_media_tool"),
        ].filter(Boolean),
        meta,
      };
    });
  } catch (error) {
    extracted = {
      evaluationError: String(error?.message ?? error),
      finalUrl: await page.url(),
      contentExists: false,
      contentTextLength: 0,
      warnings: [],
    };
  }

  const status = extracted.contentExists && extracted.contentTextLength > 100 && !(extracted.warnings?.length)
    ? "success"
    : extracted.contentTextLength > 0
      ? "partial"
      : "failed";
  const record = {
    sampleId: `WX-${String(index + 1).padStart(4, "0")}`,
    sourceIndex: index + 1,
    requestedUrl,
    startedAt,
    capturedAt: new Date().toISOString(),
    navigationError,
    status,
    ...extracted,
  };
  await fs.appendFile(outputPath, `${JSON.stringify(record)}\n`, "utf8");
  completedUrls.add(requestedUrl);
  console.log({
    progress: `${completedUrls.size}/${urls.length}`,
    sampleId: record.sampleId,
    status,
    title: record.title ?? null,
    chars: record.contentTextLength,
    warnings: record.warnings,
    navigationError,
  });
}

console.log({ taskSpaceId: task.spaceId, outputPath, completed: completedUrls.size, expected: urls.length });
