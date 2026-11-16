import fs from "node:fs/promises";

const base = "C:/Users/Administrator/Documents/ChatGPT/熵 2/ego-wechat-5";
const rows = (await fs.readFile(`${base}/raw-corpus.jsonl`, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const has = (text, pattern) => pattern.test(text || "");
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
};
const countBy = (items, getter) => {
  const map = new Map();
  for (const item of items) {
    const values = getter(item);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (!value) continue;
      map.set(value, (map.get(value) ?? 0) + 1);
    }
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]));
};
const topicRules = [
  ["电竞游戏", /LPL|TES|IG|iG|BLG|T1|Faker|Theshy|TheShy|Chovy|Ruler|369|Jackeylove|Meiko|电竞|峡谷|游戏|3A大作/iu],
  ["汽车出行", /车|汽车|小米SU7|小米澎程|理想i6|仰望|比亚迪|保时捷|奕境|岚图|Model Y|鸿蒙智行|海航|空姐/iu],
  ["娱乐明星", /明星|刘浩存|贾乃亮|倪虹洁|何洁|王传君|李健|许飞|王祖贤|鸟山明|短剧|节目|MV|封面|翻唱|顶流|粉丝/iu],
  ["艺术文化", /画|美术|艺术|央美|冷军|高定|裙子|宝石|文物|摄影|coser|作品|设计/iu],
  ["科技科学", /AI|ChatGPT|豆包|科技|航天|太空|卫星|数据中心|数学|黄仁勋|马斯克|盖茨|小米SU7的水滴大灯|蚂蚁|渐冻/iu],
  ["社会新闻", /法院|派出所|车站|酒店|遇难|坠机|起火|事故|被告|冻结|工作人员|女大学生|老师|体测|上交|网友误转账|抽中/iu],
  ["商业职场", /工资|公司|员工|裁员|职级|年入|收入|订单|卖出|销量|行业|职业|工程师|房价|工作|领导|华为/iu],
  ["生活方式", /穿搭|美甲|写真|JK|制服|蕾丝|晒太阳|照片|高跟鞋|袜子|蛋糕店|早餐|膳|乌镇|旅行|景点|楼梯|拉面|炸串|鸟屎|吊扇/iu],
  ["情感性别", /妻子|夫人|女孩|女人|少女|女主|美女|女主持|结婚|婚后|未婚|恋爱|喜欢|亲热|亲嘴|接吻|男女|男孩|中年男人|嫁|相亲|单身/iu],
  ["历史知识", /历史|大唐|王国维|诛九族|家族|军衔|女兵|签证|水泥|沥青|百科|十大|为什么|为何|解密/iu],
];

const normalized = rows.map((row) => {
  const title = row.title ?? "";
  const body = row.contentText ?? "";
  const combined = `${title}\n${body.slice(0, 1200)}`;
  const imageCount = row.layout?.imageCount ?? 0;
  const textChars = row.contentTextLength ?? 0;
  const failureReason = row.finalUrl?.includes("appmsgcaptcha")
    ? "security_verification"
    : row.bodyTextSample?.includes("根据作者隐私设置")
      ? "author_privacy_restriction"
      : row.status === "failed"
        ? "unknown"
        : null;
  const accessStatus = row.status === "failed" ? "failed" : "accessible";
  const contentForm = accessStatus === "failed"
    ? "unavailable"
    : textChars < 100 && imageCount >= 3
      ? "image_led"
      : textChars < 100
        ? "short_or_media_led"
        : textChars >= 1000 && imageCount >= 5
          ? "long_rich_media"
          : textChars >= 1000
            ? "long_text"
            : textChars >= 300 && imageCount >= 5
              ? "medium_rich_media"
              : textChars >= 300
                ? "medium_text"
                : imageCount >= 3
                  ? "image_led"
                  : "short_text";
  const topics = topicRules.filter(([, pattern]) => pattern.test(combined)).map(([name]) => name);
  if (!topics.length) topics.push("其他");
  const primaryTopic = topicRules.find(([, pattern]) => pattern.test(title))?.[0]
    ?? topicRules.find(([, pattern]) => pattern.test(body.slice(0, 500)))?.[0]
    ?? "其他";
  const flags = {
    has_number: /\d/.test(title),
    has_question: /[？?]/.test(title),
    has_exclamation: /[！!]/.test(title),
    has_quote: /[“”「」『』《》【】]/.test(title),
    has_ellipsis: /…|\.\.\./.test(title),
    first_person: /我|我们|自己/.test(title),
    second_person: /你|大家|谁/.test(title),
    curiosity_gap: /没想到|万万没想到|原来|竟|到底|为何|为什么|怎么|如何|真相|曝光|回应|发现|结果|最后|这下|啥样|什么|哪位|是谁|能不能|会不会/.test(title),
    conflict_risk: /翻车|起火|崩|被裁|禁赛|塌|输|损失|异议|拆|被告|制止|失败|危险|吓人|遗憾|涉嫌|犯罪|出轨|勒索|误转|冻结|濒危|坏消息|争议|自鸡/.test(title),
    social_proof: /网友|热搜|爆火|粉丝|投票第一|女王|顶流|冠军|全国第一|无敌|最多|最大|最高|首个|唯一|十大/.test(title),
    money_or_price: /元|万|亿|工资|收入|订单|卖|价值|开价|房价|半价|花几十万|损失|赚/.test(title),
    authority_or_scarcity: /绝密|最清晰|世界首个|首次|头回|唯一|最大|最高|顶尖|高定女王|菲尔兹奖|院长|大亨|大佬|十大|全军|全国第一/.test(title),
    edge_or_sexualized: /美女|女孩|女人|妻子|夫人|娇妻|裸|色情|身材|颜值|白女|JK|女主持|空姐|少女|甜宠|红发|蕾丝|制服|亲嘴|接吻|自鸡|花期|未婚未育|脚上的配饰/.test(title),
    timely_event: /昨晚|今天|首月|上市|曝光|回应|发文|刚|上月|现在|最新|终于|目前|11月|10月/.test(title),
    useful_howto: /如何|为什么|为何|怎么|几招|出路|一定要|这招|好使|分不清|学会|解释|解密/.test(title),
  };
  return {
    sample_id: row.sampleId,
    source_index: row.sourceIndex,
    url: row.requestedUrl,
    access_status: accessStatus,
    failure_reason: failureReason,
    title: row.title,
    title_chars: Array.from(title).length,
    author: row.author,
    account: row.account,
    published_at: row.publishTime,
    modified_at: row.modifyTime,
    ip_location: row.ipLocation,
    body_chars: textChars,
    image_count: imageCount,
    video_count: row.layout?.videoCount ?? 0,
    paragraph_count: row.layout?.paragraphCount ?? 0,
    average_paragraph_chars: row.layout?.averageParagraphChars ?? 0,
    max_paragraph_chars: row.layout?.maxParagraphChars ?? 0,
    heading_count: row.layout?.headingCount ?? 0,
    strong_count: row.layout?.strongCount ?? 0,
    centered_elements: row.layout?.centerAlignedElements ?? 0,
    content_form: contentForm,
    primary_topic: primaryTopic,
    topics,
    ...flags,
  };
});

const accessible = normalized.filter((row) => row.access_status === "accessible");
const numeric = (key) => accessible.map((row) => row[key]).filter(Number.isFinite);
const flagCounts = Object.fromEntries(
  Object.keys(normalized[0])
    .filter((key) => typeof normalized[0][key] === "boolean")
    .map((key) => [key, accessible.filter((row) => row[key]).length])
    .sort((a, b) => b[1] - a[1]),
);
const percent = (count, total = accessible.length) => Math.round((count / total) * 1000) / 10;

const metrics = {
  corpus: {
    listed_links: 139,
    unique_links: rows.length,
    exact_duplicate_links: 1,
    accessible: accessible.length,
    failed: normalized.length - accessible.length,
    access_rate_percent: percent(accessible.length, normalized.length),
    failure_reasons: countBy(normalized.filter((row) => row.failure_reason), (row) => row.failure_reason),
  },
  title: {
    chars: {
      min: Math.min(...numeric("title_chars")),
      p25: percentile(numeric("title_chars"), 0.25),
      median: percentile(numeric("title_chars"), 0.5),
      p75: percentile(numeric("title_chars"), 0.75),
      max: Math.max(...numeric("title_chars")),
      mean: Math.round(numeric("title_chars").reduce((a, b) => a + b, 0) / accessible.length * 10) / 10,
    },
    feature_counts: flagCounts,
    feature_percent_of_accessible: Object.fromEntries(Object.entries(flagCounts).map(([key, value]) => [key, percent(value)])),
  },
  content: {
    body_chars: {
      min: Math.min(...numeric("body_chars")),
      p25: percentile(numeric("body_chars"), 0.25),
      median: percentile(numeric("body_chars"), 0.5),
      p75: percentile(numeric("body_chars"), 0.75),
      max: Math.max(...numeric("body_chars")),
      mean: Math.round(numeric("body_chars").reduce((a, b) => a + b, 0) / accessible.length),
    },
    image_count: {
      median: percentile(numeric("image_count"), 0.5),
      p75: percentile(numeric("image_count"), 0.75),
      max: Math.max(...numeric("image_count")),
      zero_count: accessible.filter((row) => row.image_count === 0).length,
    },
    content_forms: countBy(accessible, (row) => row.content_form),
    primary_topics: countBy(accessible, (row) => row.primary_topic),
    topics_multi_label: countBy(accessible, (row) => row.topics),
  },
  accounts: {
    known_count: accessible.filter((row) => row.account).length,
    unique_known_accounts: new Set(accessible.map((row) => row.account).filter(Boolean)).size,
    top_accounts: Object.fromEntries(Object.entries(countBy(accessible, (row) => row.account)).slice(0, 20)),
  },
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const string = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};
const headers = Object.keys(normalized[0]);
const csv = [
  headers.join(","),
  ...normalized.map((row) => headers.map((key) => csvEscape(row[key])).join(",")),
].join("\n");

await fs.writeFile(`${base}/articles-normalized.csv`, `\uFEFF${csv}\n`, "utf8");
await fs.writeFile(`${base}/corpus-metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
await fs.writeFile(`${base}/source-links.txt`, `${rows.map((row) => row.requestedUrl).join("\n")}\n`, "utf8");
console.log(JSON.stringify(metrics, null, 2));
