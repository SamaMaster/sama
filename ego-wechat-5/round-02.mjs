const fs = await import("node:fs/promises");

const task = await taskSpace(2);
const page = task.page("p1");
await page.goto("https://mp.weixin.qq.com/s/kky1qX5eoYMF4nn5yc8ipA", {
  timeout: 45000,
  waitUntil: "domcontentloaded",
});

const details = await page.evaluate(() => {
  const pick = (selector) =>
    [...document.querySelectorAll(selector)].map((node) => ({
      tag: node.tagName,
      id: node.id || null,
      className: typeof node.className === "string" ? node.className : null,
      text: node.textContent?.trim() || null,
      content: node.getAttribute("content"),
      href: node.getAttribute("href"),
    }));

  const namedGlobals = {};
  for (const name of [
    "nickname",
    "author",
    "ct",
    "publish_time",
    "msg_title",
    "ori_head_img_url",
    "hd_head_img",
    "user_name",
    "biz",
  ]) {
    try {
      const value = window[name];
      namedGlobals[name] = ["string", "number", "boolean"].includes(typeof value) ? value : null;
    } catch {
      namedGlobals[name] = null;
    }
  }

  return {
    url: location.href,
    title: document.title,
    meta: pick("meta"),
    titleNodes: pick("#activity-name, .rich_media_title, h1"),
    accountNodes: pick("#js_name, #js_author_name, .rich_media_meta_nickname, .wx_follow_nickname, a[href*='profile_ext']"),
    timeNodes: pick("#publish_time, #js_ip_wording, .rich_media_meta_text"),
    footerNodes: pick(".rich_media_meta_list, .rich_media_tool, #js_profile_qrcode, #js_pc_qr_code"),
    namedGlobals,
    bodyText: document.body?.innerText ?? "",
  };
});

const outputPath = "C:/Users/Administrator/Documents/ChatGPT/熵 2/ego-wechat-5/article-4-diagnostic.json";
await fs.writeFile(outputPath, JSON.stringify(details, null, 2), "utf8");
console.log({ taskSpaceId: task.spaceId, outputPath, title: details.title, globals: details.namedGlobals });
console.log(await page.snapshot({ scope: "full_page" }));
