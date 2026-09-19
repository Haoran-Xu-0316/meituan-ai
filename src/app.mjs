import { WORKSHOPS, workshopText } from "../data/workshops.mjs";
import {
  PEOPLE,
  SKILLS,
  CATEGORIES,
  LEVELS,
  FORMATS,
  SLOT_OPTIONS,
  slotLabel,
  initialState,
} from "../data/seed.mjs";
import {
  loadState,
  saveState,
  match,
  matches,
  validatePost,
  createExchange,
  transition,
  askDemoQuestion,
  DEMO_QUESTIONS,
  STATUS,
  availableLessonTimes,
  beijingDate,
} from "./model.mjs";
const paths = {
  discover: "M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z",
  match: "M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4",
  exchange: "M8 3h8v4H8zM5 5H3v16h18V5h-2M7 12h10M7 16h6",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-2a8 8 0 0116 0v2",
  search: "M20 20l-5-5M17 10a7 7 0 11-14 0 7 7 0 0114 0z",
  plus: "M12 5v14M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  back: "M20 12H4m6-6-6 6 6 6",
  heart:
    "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 000-7.8z",
  clock: "M12 8v5l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
  video: "M15 8l7-4v16l-7-4M2 5h13v14H2z",
  check: "M5 12l4 4L19 6",
  close: "M6 6l12 12M6 18 18 6",
  code: "M8 5l-6 7 6 7M16 5l6 7-6 7M14 3l-4 18",
  camera: "M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 11-8 0 4 4 0 018 0z",
  table: "M3 3h18v18H3zM3 9h18M9 3v18M3 15h18",
  message: "M21 4H3v13h5l4 4 4-4h5zM7 9h10M7 13h6",
  music:
    "M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 11-3-3 3 3 0 013 3zM21 16a3 3 0 11-3-3 3 3 0 013 3z",
  pen: "M16 3l5 5L8 21H3v-5zM13 6l5 5",
  layout: "M3 3h18v18H3zM3 8h18M9 8v13",
  mic: "M8 3h8v11H8zM5 11v3a7 7 0 0014 0v-3M12 21v-3",
  globe:
    "M22 12a10 10 0 11-20 0 10 10 0 0120 0zM2 12h20M12 2c6 5 6 15 0 20-6-5-6-15 0-20",
  film: "M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  info: "M12 11v6M12 7h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
  edit: "M16 3l5 5L8 21H3v-5z",
  chevron: "m9 5 7 7-7 7",
  leaf: "M20 3C5 2 1 9 5 16c7 7 16 1 15-13zM5 20 16 9",
  filter: "M4 7h16M7 12h10M10 17h4",
  mail: "M3 5h18v14H3zM3 5l9 8 9-8",
};
const icon = (name, cls = "") =>
  /* HTML */ `<svg
    class="icon ${cls}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="${paths[name] || paths.leaf}" />
  </svg>`;
const escape = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const app = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
// Keep navigation and transient form state separate from persisted exchange records.
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw Error("Storage unavailable");
    },
    setItem() {
      throw Error("Storage unavailable");
    },
  };
}
let loaded = loadState(storage),
  state = loaded.state,
  filter = { q: "", category: "全部", format: "", slot: "", mutual: false },
  exchangeTab = "全部",
  step = state.draft ? state.draftStep || 1 : 1,
  draft = state.draft || null;
let toastTimer;
const toast = (msg) => {
  const t = document.querySelector("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
};
let storageFailed = false;
const persist = () => {
  storageFailed = !saveState(storage, state);
  const banner = document.querySelector("#save-warning");
  if (banner) banner.hidden = !storageFailed;
  return !storageFailed;
};
const route = () => location.hash.slice(1) || "/discover";
let previousRoute = route();
const personReturnRoutes = new Map();
const go = (path) => {
  if (route() === path) render();
  else location.hash = path;
};
const timeText = (iso) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
const avatar = (p, size = "") =>
  /* HTML */ `<span
    class="avatar ${size}"
    style="--avatar:${SKILLS[p.teach[0]]?.color ||
    "#FFF1BD"};--avatar-ink:${SKILLS[p.teach[0]]?.ink || "#846A14"}"
    >${escape(p.name.slice(-2))}</span
  >`;
const pill = (t, cls = "") =>
  /* HTML */ `<span class="pill ${cls}">${escape(t)}</span>`;
const back = () =>
  /* HTML */ `<button class="text-btn back" data-action="back">
    ${icon("back")}返回
  </button>`;
const badge = (status) =>
  /* HTML */ `<span class="status status-${status}">${STATUS[status]}</span>`;
const field = (label, body, hint = "") =>
  /* HTML */ `<label class="field"
    ><span>${label}</span>${body}${hint
      ? /* HTML */ `<small>${hint}</small>`
      : ""}</label
  >`;
const select = (name, items, current, placeholder = "") =>
  /* HTML */ `<select name="${name}">
    ${placeholder
      ? /* HTML */ `<option value="">${placeholder}</option>`
      : ""}${items
      .map(
        (x) =>
          /* HTML */ `<option
            value="${escape(x)}"
            ${x === current ? "selected" : ""}
          >
            ${escape(x)}
          </option>`,
      )
      .join("")}
  </select>`;
const empty = (title, copy, href = "/discover", action = "去发现技能") =>
  /* HTML */ `<div class="empty">
    ${icon("leaf")}
    <h2>${title}</h2>
    <p>${copy}</p>
    <a class="btn primary" href="#${href}">${action}${icon("arrow")}</a>
  </div>`;
function header() {
  const r = route().split("/")[1];
  const nav = [
    ["discover", "发现技能", "discover"],
    ["matches", "我的匹配", "match"],
    ["exchanges", "我的交换", "exchange"],
    ["profile", "我的", "user"],
  ];
  return /* HTML */ `<aside class="sidebar">
      <a class="brand" href="#/discover"
        ><span class="brand-mark">${icon("match")}</span>SkillPal<span
          class="brand-dot"
        ></span
      ></a>
      <div class="nav-caption">技能互换平台</div>
      <nav aria-label="主导航">
        ${nav
          .map(
            ([id, name, i]) =>
              /* HTML */ `<a
                href="#/${id}"
                class="nav-link ${r === id ? "active" : ""}"
                ${r === id ? 'aria-current="page"' : ""}
                >${icon(i)}<span>${name}</span>${id === "exchanges" &&
                state.exchanges.some((e) => e.status === "pending")
                  ? '<span class="nav-count">' +
                    state.exchanges.filter((e) => e.status === "pending")
                      .length +
                    "</span>"
                  : ""}</a
              >`,
          )
          .join("")}
      </nav>
    </aside>
    <header class="topbar">
      <a class="mobile-brand" href="#/discover">${icon("match")}SkillPal</a>
      <form id="search-form" class="search">
        ${icon("search")}<input
          name="q"
          aria-label="搜索技能或学习目标"
          placeholder="搜一搜，你想学什么？"
          value="${escape(filter.q)}"
        /><button aria-label="搜索" type="submit">${icon("arrow")}</button>
      </form>
      <div class="top-actions">
        <span class="demo-label">交互演示</span
        ><a class="btn primary" href="#/publish" aria-label="发布技能"
          >${icon("plus")}<span>发布技能</span></a
        >
      </div>
    </header>
    <nav class="mobile-nav" aria-label="移动导航">
      ${nav
        .map(
          ([id, name, i]) =>
            /* HTML */ `<a
              href="#/${id}"
              class="${r === id ? "active" : ""}"
              ${r === id ? 'aria-current="page"' : ""}
              >${icon(i)}${name}</a
            >`,
        )
        .join("")}
    </nav>`;
}
// Each fictional partner has a distinct lesson scene, not a verified profile photograph.
const PARTNER_COVERS = {
  lin: ["coding", "一起练习数据清洗脚本", "50% 46%"],
  zhou: ["design", "从纸上草图搭建界面", "60% 55%"],
  chen: ["excel-report", "月度报表与分类汇总练习", "50% 50%"],
  xu: ["english-interview", "在校园里练习英文自我介绍", "50% 45%"],
  lu: ["street-photography", "用手机观察街头光线与构图", "50% 48%"],
  jiang: ["music", "放慢速度练习吉他和弦", "60% 42%"],
  song: ["personal-webpage", "个人网页在电脑和手机上的布局", "50% 48%"],
  he: ["video-editing", "在时间线上整理短片镜头", "50% 45%"],
  tang: ["python-tool", "用函数整理文件名清单", "50% 50%"],
  shen: ["japanese-travel", "在餐馆用日语练习点餐", "50% 50%"],
  gu: ["music-theory", "借助琴键理解节拍与音程", "50% 55%"],
  wen: ["javascript-todo", "给待办列表添加点击交互", "50% 50%"],
};
function card(p, why = false) {
  const sk = SKILLS[p.teach[0]],
    m = match(state.me, p),
    saved = state.favorites.includes(p.id);
  const [photo, photoDescription, photoPosition] = PARTNER_COVERS[p.id];
  return /* HTML */ `<article class="skill-card">
    <a
      class="skill-cover"
      href="#/person/${p.id}"
      style="--cover:${sk.color};--photo-position:${photoPosition}"
      aria-label="查看${escape(p.name)}的${escape(p.teach[0])}技能"
      ><img class="cover-photo" src="./assets/photos/${photo}.webp" alt="AI生成场景：${photoDescription}" width="1536" height="1024" loading="lazy" decoding="async" />
      <span class="photo-label">AI场景</span>
      <span class="cover-copy"><strong>${escape(p.teach.join(" / "))}</strong></span></a
    ><button
      class="favorite ${saved ? "saved" : ""}"
      data-action="favorite"
      data-id="${p.id}"
      aria-label="${saved ? "取消收藏" : "收藏"}${escape(p.name)}"
      aria-pressed="${saved}"
    >
      ${icon("heart")}
    </button>
    <div class="card-body">
      <h3 class="card-title"><a href="#/person/${p.id}">${escape(p.goal)}</a></h3>
      <div class="person-line">
        ${avatar(p)}
        <div>
          <strong>${escape(p.name)}</strong><span>${escape(p.job)}</span>
        </div>
        <span class="sample">示例</span>
      </div>
      <div class="skill-row wanted">
        <span class="role want">想学</span>
        <p>${escape(p.want.join("、"))}</p>
      </div>
      ${why
        ? /* HTML */ `<div class="match-reasons">
            ${icon("check")}<span
              >${escape(m.learn.join("、"))}换${escape(m.teach.join("、"))}${m
                .slots.length
                ? `，${escape(slotLabel(m.slots[0]))}都有空`
                : "，需要协商时间"}</span
            >
          </div>`
        : ""}
      <div class="card-bottom">
        <span
          >${p.audience === "零基础" ? "零基础友好" : p.audience + "适用"}</span
        ><a class="card-link" href="#/person/${p.id}"
          >${why ? "查看匹配" : "认识一下"}${icon("arrow")}</a
        >
      </div>
    </div>
  </article>`;
}
function discover() {
  const people = PEOPLE.filter(
    (p) =>
      p.active &&
      (filter.category === "全部" ||
        SKILLS[p.teach[0]].category === filter.category) &&
      (!filter.format || p.formats.includes(filter.format)) &&
      (!filter.slot || p.slots.includes(filter.slot)) &&
      (!filter.mutual || match(state.me, p).eligible) &&
      (!filter.q ||
        [p.name, ...p.teach, ...p.want, p.goal, p.learnGoal]
          .join(" ")
          .toLowerCase()
          .includes(filter.q.toLowerCase())),
  );
  return /* HTML */ `<section class="discovery-intro">
      <div class="intro-heading"><h1>用你会的，换你想学的。</h1><a class="btn dark" href="#/matches">${state.me.active ? `查看${matches(state.me, PEOPLE).length}位匹配` : "查看匹配"}${icon("arrow")}</a></div>
      <div class="intro-skills"><span>我能教<strong>${escape(state.me.teach.join("、"))}</strong></span>${icon("match")}<span>我想学<strong>${escape(state.me.want.join("、"))}</strong></span><a class="text-btn" href="#/publish" aria-label="编辑我的供需">编辑${icon("edit")}</a></div>
      <details class="intro-help"><summary>如何体验一次技能交换</summary><div class="guide-steps"><div><strong>1.看看谁和你互补</strong><p>默认身份小麦能教摄影、想学Python。在我的匹配中，林予安与你技能互补且有共同时间。</p><a class="text-btn" href="#/person/lin">查看这位伙伴${icon("arrow")}</a></div><div><strong>2.约定两节课</strong><p>查看课程安排，发送邀请后点击模拟对方接受。两节课分别记录你教什么、你学什么。</p></div><div><strong>3.记录学到的东西</strong><p>分别模拟完成两节课，写下收获并评价。也可以修改自己的供需，看看匹配结果如何变化。</p></div></div><p class="guide-note">人物、经历和评价均为示例，卡片场景图由AI生成。操作只保存在当前浏览器，不会联系真实用户。</p></details>
    </section>
    <section aria-labelledby="discover-title">
      <div class="section-heading">
        <div>
          <h2 id="discover-title">发现技能</h2>
        </div>
        <span class="subtle desktop-only">线上交流，每人45分钟</span>
      </div>
      <div class="category-tabs" role="group" aria-label="技能分类">
        ${CATEGORIES.map(
          (c) =>
            /* HTML */ `<button
              class="category ${filter.category === c ? "selected" : ""}"
              data-action="category"
              data-value="${c}"
              aria-pressed="${filter.category === c}"
            >
              ${c === "全部"
                ? icon("discover")
                : icon(
                    SKILLS[
                      Object.keys(SKILLS).find((k) => SKILLS[k].category === c)
                    ].icon,
                  )}${c}
            </button>`,
        ).join("")}
      </div>
      <div class="filter-line">
        <div class="filters">
          ${icon("filter")}<label class="sr-only" for="format-filter"
            >教学形式</label
          ><select id="format-filter">
            <option value="">全部教学形式</option>
            ${FORMATS.map(
              (x) =>
                /* HTML */ `<option ${filter.format === x ? "selected" : ""}>
                  ${x}
                </option>`,
            ).join("")}</select
          ><label class="sr-only" for="slot-filter">可用时间</label
          ><select id="slot-filter">
            <option value="">全部时间</option>
            ${SLOT_OPTIONS.map(
              (x) =>
                /* HTML */ `<option
                  value="${x}"
                  ${filter.slot === x ? "selected" : ""}
                >
                  ${slotLabel(x)}
                </option>`,
            ).join("")}</select
          ><label class="check-inline"
            ><input
              id="mutual-filter"
              type="checkbox"
              ${filter.mutual ? "checked" : ""}
            />只看双向匹配</label
          >
        </div>
        <span class="subtle">${people.length}位技能伙伴</span>
      </div>
      ${filter.q
        ? /* HTML */ `<div class="search-result">
            搜索“${escape(filter.q)}”<button
              class="text-btn"
              data-action="clear-search"
            >
              清除${icon("close")}
            </button>
          </div>`
        : ""}${people.length
        ? /* HTML */ `<div class="card-grid">
            ${people.map((p) => card(p)).join("")}
          </div>`
        : empty(
            "暂时没有找到合适的伙伴",
            "试试其他技能，或放宽时间与形式条件。",
            "/discover",
            "清除筛选",
          )}

    </section>`;
}
function matching() {
  const list = matches(state.me, PEOPLE),
    overlap = list.filter((m) => m.slots.length),
    other = list.filter((m) => !m.slots.length);
  return /* HTML */ `<div class="page-heading">

      <h1>我的技能伙伴</h1>
      <p>基于双方技能需求、学习基础、教学形式与可用时间推荐。</p>
    </div>
    <div class="match-summary">
      <div>
        <span>我能教</span><strong>${escape(state.me.teach.join("、"))}</strong>
      </div>
      ${icon("match")}
      <div>
        <span>我想学</span><strong>${escape(state.me.want.join("、"))}</strong>
      </div>
      <a class="btn secondary" href="#/publish">调整需求${icon("edit")}</a>
    </div>
    ${!state.me.active
      ? empty(
          "你的技能已暂停",
          "重新发布后，我们会继续为你寻找互补伙伴。",
          "/publish",
          "重新发布",
        )
      : !list.length
        ? empty(
            "还差一点，就能互相需要",
            "试试补充一项你能教的技能，或调整想学的内容与教学形式。",
            "/publish",
            "调整我的供需",
          )
        : `${
            overlap.length
              ? /* HTML */ `<div class="section-heading">
                    <h2>
                      技能互补，时间也刚好<span class="count-label"
                        >${overlap.length}</span
                      >
                    </h2>
                  </div>
                  <div class="card-grid">
                    ${overlap.map((m) => card(m.person, true)).join("")}
                  </div>`
              : ""
          }${
            other.length
              ? /* HTML */ `<div class="section-heading spaced">
                    <div>
                      <h2>技能合拍，再约个时间</h2>
                      <p>双方需求互补，但当前没有共同可用时段。</p>
                    </div>
                  </div>
                  <div class="card-grid">
                    ${other.map((m) => card(m.person, true)).join("")}
                  </div>`
              : ""
          }`}
    <div class="notice">
      ${icon(
        "info",
      )}匹配依据来自双方填写的资料，不代表平台认证。人物和经历均为演示数据。
    </div>`;
}
function materialBlock(block) {
  const heading = `<h4>${escape(block.title)}</h4>`;
  if (block.type === "table") {
    return `${heading}<div class="material-table" tabindex="0" role="region" aria-label="${escape(block.title)}"><table><thead><tr>${block.columns.map((column) => `<th scope="col">${escape(column)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  if (block.type === "code") {
    return `<details class="material-code"><summary>${escape(block.title)}</summary><pre tabindex="0"><code>${escape(block.content)}</code></pre></details>`;
  }
  return `${heading}<p class="material-text">${escape(block.content)}</p>`;
}
function materialDownload(name, content, label = name) {
  const payload = name.endsWith(".csv") ? "\uFEFF" + content : content;
  return `<a class="material-download" href="data:text/plain;charset=utf-8,${encodeURIComponent(payload)}" download="${escape(name)}">${icon("arrow")}${escape(label)}</a>`;
}
function workshop(p) {
  const content = WORKSHOPS[p.id];
  return `<details class="detail-section workshop"><summary>实操样例与材料<span>含参考答案</span></summary>
    <h3 class="workshop-title">${escape(content.title)}</h3><p>${escape(content.brief)}</p>
    <div class="material-downloads">${materialDownload(p.id + "-practice.txt", workshopText(content), "下载完整练习讲义")}${(content.files || []).map((file) => materialDownload(file.name, file.content)).join("")}</div>
    ${content.blocks.map(materialBlock).join("")}
    <section class="material-result">${materialBlock(content.expected)}</section>
    <section class="material-challenge"><h4>自己试一试</h4><p>${escape(content.challenge)}</p><details><summary>查看参考答案</summary><p>${escape(content.answer)}</p></details></section>
    ${content.source ? `<p class="material-source">参考资料：<a href="${escape(content.source[1])}" target="_blank" rel="noopener noreferrer">${escape(content.source[0])}</a></p>` : ""}
  </details>`;
}
function lessonPlan(p) {
  const lesson = p.lesson;
  return `<details class="detail-section"><summary>课程安排与练习<span>45分钟</span></summary>
    <ol class="agenda">${lesson.agenda.map(([minutes, title, text]) => `<li><span class="agenda-time">${minutes}<small>分钟</small></span><div><h3>${escape(title)}</h3><p>${escape(text)}</p></div></li>`).join("")}</ol>
    <h3>学完可以带走</h3><p>${escape(lesson.takeaway)}</p>
    <h3>课前准备</h3><ul class="preparation-list">${lesson.prepare.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>
    <h3>课后练习</h3><p>${escape(lesson.practice)}</p><h3>这次先不涉及</h3><p>${escape(p.context.boundary)}</p></details>`;
}
function detail(p) {
  const m = match(state.me, p);
  const actionPath = m.eligible ? "/invite/" + p.id : "/publish?return=" + p.id;
  const actionLabel = m.eligible ? "发起技能交换" : "调整供需后交换";
  const reasons = [];
  if (!state.me.active) reasons.push("你的技能已暂停，请先重新发布。");
  else if (!m.teach.length || !m.learn.length) reasons.push("双方技能需求尚未互补，调整供需后再交换。");
  else reasons.push(`你教${m.teach.join("、")}，向TA学${m.learn.join("、")}。`);
  if (!m.formats.length) reasons.push("暂时没有共同教学形式。");
  if (m.fit !== 2) reasons.push("开始前请确认教学难度是否适合彼此。");
  return `${back()}
    <header class="partner-header">
      <div class="partner-identity">${avatar(p, "large")}<div><h1>${escape(p.name)}</h1><p>${escape(p.job)}<span class="sample">演示伙伴</span></p></div></div>
      <button class="btn secondary" data-action="favorite" data-id="${p.id}" aria-pressed="${state.favorites.includes(p.id)}">${icon("heart")}${state.favorites.includes(p.id) ? "已收藏" : "收藏"}</button>
    </header>
    <section class="panel partner-offer">
      <div><span class="role teach">TA能教</span><h2>${escape(p.teach.join("、"))}</h2><p>${escape(p.goal)}</p><small>${escape(p.audience)}适用</small></div>
      <div><span class="role want">TA想学</span><h2>${escape(p.want.join("、"))}</h2><p>${escape(p.learnGoal)}</p><small>目前基础：${escape(p.level)}</small></div>
    </section>
    <div class="detail-layout partner-layout">
      <section class="panel course-summary">
        ${workshop(p)}
        ${lessonPlan(p)}
        <details class="detail-section"><summary>了解${escape(p.name)}</summary><p>${escape(p.bio)}</p><h3>为什么想学${escape(p.want.join("、"))}</h3><p>${escape(p.context.purpose)}</p><h3>目前卡在哪里</h3><p>${escape(p.context.obstacle)}</p><h3>分享经验</h3><p>${escape(p.experience)}。</p><h3>我习惯怎么交流</h3><p>${escape(p.context.style)}</p></details>
        <details class="detail-section"><summary>学习反馈<span>示例与本地评价</span></summary><div class="review-sample"><p>${escape(p.lesson.review)}</p><small>示例评价</small></div>${state.exchanges.filter((e) => e.personId === p.id && e.review).map((e) => `<div class="review-sample"><span class="stars">${"★".repeat(e.review.rating)}</span><p>${escape(e.review.text)}</p><small>我的本地演示评价</small></div>`).join("")}</details>
      </section>
      <aside class="panel exchange-aside partner-exchange">
        <div class="availability"><h3>可约时间</h3><p class="subtle">每周固定时段，北京时间</p><div class="tag-list">${p.slots.map((slot) => pill(slotLabel(slot), m.slots.includes(slot) ? "yellow" : "")).join("")}</div><small>${m.slots.length ? "黄色时段为双方共同空闲" : "与你的空闲时间不同，需要协商"}</small></div>
        <p class="match-note">${escape(reasons.join(" "))}</p>
        <a class="btn primary full desktop-invite" href="#${actionPath}">${actionLabel}${icon("arrow")}</a>
        <p class="fine-print">${escape(p.formats.join(" / "))}<br>免费互换，每人45分钟。</p>
      </aside>
    </div>
    <p class="detail-disclosure">人物、课程与反馈为演示内容，操作仅保存在当前浏览器。</p>
    <div class="mobile-invite"><a class="btn primary full" href="#${actionPath}">${actionLabel}${icon("arrow")}</a></div>`;
}
function checkboxGroup(name, values, selected, labels = values) {
  return /* HTML */ `<div class="choice-grid">
    ${values
      .map(
        (v, i) =>
          /* HTML */ `<label class="choice"
            ><input
              type="checkbox"
              name="${name}"
              value="${escape(v)}"
              ${selected.includes(v) ? "checked" : ""}
            /><span>${escape(labels[i])}</span></label
          >`,
      )
      .join("")}
  </div>`;
}
function publish() {
  if (!draft) {
    draft = structuredClone(state.me);
    step = 1;
  }
  const d = draft;
  return /* HTML */ `<div class="form-page">
    ${back()}
    <div class="page-heading">

      <h1>${state.me.published ? "编辑我的技能供需" : "发布技能"}</h1>
      <p>不用是专家，一次分享能帮助对方前进一步就很好。</p>
    </div>
    <ol class="steps">
      ${["我能教", "我想学", "交换安排"]
        .map(
          (x, i) =>
            /* HTML */ `<li
              class="${step === i + 1 ? "current" : step > i + 1 ? "done" : ""}"
            >
              <span>${step > i + 1 ? icon("check") : i + 1}</span>${x}
            </li>`,
        )
        .join("")}
    </ol>
    <form id="publish-form" class="panel form-panel">
      <div class="form-error" role="alert"></div>
      ${step === 1
        ? /* HTML */ `<h2>你愿意分享什么？</h2>
            <p class="subtle">选择1至3项技能，描述一次可以完成的小成果。</p>
            <fieldset>
              <legend>我能教的技能</legend>
              ${checkboxGroup("teach", Object.keys(SKILLS), d.teach)}
            </fieldset>
            <div class="form-two">
              ${field(
                "我的熟练程度",
                select(
                  "proficiency",
                  ["熟悉", "熟练"],
                  d.proficiency || "熟练",
                ),
              )}${field(
                "适合对方的基础",
                select("audience", LEVELS, d.audience),
              )}
            </div>
            ${field(
              "一节课可以教会什么",
              /* HTML */ `<textarea
                name="goal"
                required
                maxlength="200"
                placeholder="例如：掌握手机构图和自然光，拍出一张满意的人像"
              >
${escape(d.goal)}</textarea
              >`,
              "成果具体一点，伙伴更容易判断是否适合。",
            )}${field(
              "你的分享经验",
              /* HTML */ `<textarea
                name="experience"
                required
                maxlength="200"
                placeholder="可以写学习经历、作品或帮助朋友的经验"
              >
${escape(d.experience)}</textarea
              >`,
            )}`
        : step === 2
          ? /* HTML */ `<h2>给好奇心一个方向</h2>
              <p class="subtle">想学什么，就从一个小目标开始。</p>
              <fieldset>
                <legend>我想学的技能，选择1至3项</legend>
                ${checkboxGroup("want", Object.keys(SKILLS), d.want)}
              </fieldset>
              ${field("我目前的基础", select("level", LEVELS, d.level))}${field(
                "我希望学会什么",
                /* HTML */ `<textarea
                  name="learnGoal"
                  required
                  maxlength="200"
                  placeholder="例如：用Python自动整理多个Excel文件"
                >
${escape(d.learnGoal)}</textarea
                >`,
              )}`
          : /* HTML */ `<h2>留一点时间，一起进步</h2>
              <fieldset>
                <legend>可用时段，北京时间</legend>
                ${checkboxGroup(
                  "slots",
                  SLOT_OPTIONS,
                  d.slots,
                  SLOT_OPTIONS.map(slotLabel),
                )}
              </fieldset>
              <fieldset>
                <legend>支持的线上教学形式</legend>
                ${checkboxGroup("formats", FORMATS, d.formats)}
              </fieldset>
              <div class="publish-preview">
                <span class="eyebrow">发布预览</span>
                <h3>
                  ${escape(d.teach.join("、"))}${icon("match")}${escape(
                    d.want.join("、"),
                  )}
                </h3>
                <p><strong>我能教：</strong>${escape(d.goal)}</p>
                <p><strong>我想学：</strong>${escape(d.learnGoal)}</p>
                <small>双方各分享45分钟，不收取费用。</small>
              </div>`}
      <div class="form-actions">
        ${step > 1
          ? '<button type="button" class="btn secondary" data-action="previous-step">上一步</button>'
          : '<span class="subtle">输入内容会自动保存在本机</span>'}<button
          class="btn primary"
          type="submit"
        >
          ${step === 3 ? "发布并查看匹配" : "下一步"}${icon("arrow")}
        </button>
      </div>
    </form>
  </div>`;
}
function invite(p) {
  const m = match(state.me, p);
  if (!m.eligible)
    return empty(
      "先让彼此的技能对上",
      "调整自己的能教和想学，再来邀请这位伙伴。",
      "/publish",
      "调整技能",
    );
  const preferred = availableLessonTimes(state, m.slots.length ? m.slots : state.me.slots);
  const existing = state.exchanges.filter((e) => e.personId === p.id && !["completed", "cancelled", "declined"].includes(e.status));
  const t1 = preferred[0] || "",
    t2 = preferred[1] || "";
  const local = (iso) =>
    iso
      ? new Date(new Date(iso).getTime() + 8 * 3600000)
          .toISOString()
          .slice(0, 16)
      : "";
  const now = new Date();
  const min = local(new Date(now.getTime() + 60000).toISOString()),
    max = local(new Date(now.getTime() + 14 * 86400000).toISOString());
  return /* HTML */ `<div class="form-page">
    ${back()}
    <div class="page-heading">

      <h1>邀请${escape(p.name)}交换技能</h1>
      <p>确认交换技能，并安排两次交流时间。</p>
    </div>
    ${existing.length ? `<div class="notice invitation-existing"><div><strong>你们已有进行中的交换</strong><p>相同技能无需重复邀请，可以继续之前的约定。</p>${existing.map((e) => `<a class="text-btn" href="#/exchange/${e.id}">查看${escape(e.teach)}与${escape(e.learn)}的交换${icon("arrow")}</a>`).join("")}</div></div>` : ""}
    <form id="invite-form" data-person="${p.id}" class="panel form-panel">
      <div class="form-error" role="alert"></div>
      <div class="form-two">
        ${field("我来教", select("teach", m.teach, m.teach[0]))}${field(
          "我来学",
          select("learn", m.learn, m.learn[0]),
        )}
      </div>
      <div class="invitation-goals">
        <p><strong>我分享的成果</strong>${escape(state.me.goal)}</p>
        <p><strong>TA分享的成果</strong>${escape(p.goal)}</p>
      </div>
      <h2>安排两次45分钟的交流</h2>
      <p class="subtle">
        北京时间，选择未来14天内的时间。${m.slots.length
          ? "已优先填入双方共同可用时段，并避开已有交换。"
          : "暂无共同空闲，以下空闲时间作为待协商提议。"}
      </p>
      ${preferred.length < 2 ? '<p class="notice">常用时段中不足两次空闲，请手动选择其他时间，与伙伴协商后再约定。</p>' : ""}
      <div class="form-two">
        ${field(
          "第一节：我来教",
          /* HTML */ `<input
            type="datetime-local"
            name="time1"
            required
            min="${min}"
            max="${max}"
            value="${local(t1)}"
          />`,
        )}${field(
          "第二节：TA来教",
          /* HTML */ `<input
            type="datetime-local"
            name="time2"
            required
            min="${min}"
            max="${max}"
            value="${local(t2)}"
          />`,
        )}
      </div>
      ${field("教学形式", select("format", m.formats, m.formats[0]))}${field(
        "给伙伴的一句话",
        /* HTML */ `<textarea name="note" required maxlength="300">
你好，我可以分享${escape(m.teach[0])}，想向你学${escape(
            m.learn[0],
          )}。我的目标是${escape(state.me.learnGoal)}。这次可以一起完成吗？</textarea
        >`,
      )}
      <div class="notice">
        ${icon("info")}这是本地演示邀请，不会发送给真实用户。
      </div>
      <div class="form-actions">
        <a class="btn secondary" href="#/person/${p.id}">再看看</a
        ><button class="btn primary">发送交换邀请${icon("arrow")}</button>
      </div>
    </form>
  </div>`;
}
function exchanges() {
  const groups = {
    全部: () => true,
    待回应: (e) => e.status === "pending",
    进行中: (e) => ["scheduled", "learning", "review"].includes(e.status),
    已完成: (e) => e.status === "completed",
    已结束: (e) => ["declined", "cancelled"].includes(e.status),
  };
  const list = state.exchanges.filter(groups[exchangeTab]);
  return /* HTML */ `<div class="page-heading">

      <h1>我的交换</h1>
      <p>查看邀请、课程进度和评价。</p>
    </div>
    <div class="segmented">
      ${Object.keys(groups)
        .map(
          (t) =>
            /* HTML */ `<button
              data-action="exchange-tab"
              data-value="${t}"
              class="${exchangeTab === t ? "selected" : ""}"
            >
              ${t}<span>${state.exchanges.filter(groups[t]).length}</span>
            </button>`,
        )
        .join("")}
    </div>
    ${list.length
      ? /* HTML */ `<div class="exchange-list">
          ${list
            .map(
              (e) =>
                /* HTML */ `<a class="exchange-row" href="#/exchange/${e.id}"
                  ><div class="person-line">
                    ${avatar(PEOPLE.find((p) => p.id === e.personId))}
                    <div>
                      <strong>与${escape(e.personName)}的交换</strong
                      ><span>${escape(e.teach)}${" ⇄ "}${escape(e.learn)}</span>
                    </div>
                  </div>
                  <div class="row-progress">
                    <span
                      >${e.lessons.filter((l) => l.done)
                        .length}/2节课程完成</span
                    >
                    <div class="mini-progress">
                      <i
                        style="width:${e.lessons.filter((l) => l.done).length *
                        50}%"
                      ></i>
                    </div>
                  </div>
                  ${badge(e.status)}${icon("chevron")}</a
                >`,
            )
            .join("")}
        </div>`
      : empty(
          "这里还没有交换记录",
          exchangeTab === "全部"
            ? "找一位互相需要的伙伴，开始你的第一次交换。"
            : "这个分类暂时没有记录，可以切换其他分类查看。",
          "/matches",
          "寻找技能伙伴",
        )}`;
}
function exchangeDetail(e) {
  const p = PEOPLE.find((x) => x.id === e.personId);
  const end = ["completed", "cancelled", "declined"].includes(e.status);
  return `${back()}<div class="page-heading exchange-heading"><div><h1>与${escape(e.personName)}的技能交换</h1><p>${escape(e.teach)}交换${escape(e.learn)}，${escape(e.format)}。</p></div>${badge(e.status)}</div>${
    e.status === "pending"
      ? /* HTML */ `<div class="demo-control">
          <div>
            ${icon("info")}<span
              ><strong>邀请已保存，等待回应</strong
              ><small>演示控制：选择一种回应，继续体验交换流程。</small></span
            >
          </div>
          <div>
            <button
              class="btn secondary"
              data-action="decline"
              data-id="${e.id}"
            >
              模拟对方拒绝</button
            ><button class="btn primary" data-action="accept" data-id="${e.id}">
              模拟对方接受${icon("check")}
            </button>
          </div>
        </div>`
      : ""
  }${e.reason ? /* HTML */ `<div class="notice">${icon("info")}取消原因：${escape(e.reason)}</div>` : ""}<div class="detail-layout"><div><section class="panel"><div class="section-heading compact"><h2>我们的两节课</h2><span class="subtle">北京时间，每节45分钟</span></div><div class="lesson-list">${e.lessons
    .map(
      (l, i) =>
        /* HTML */ `<article class="lesson ${l.done ? "done" : ""}">
          <div class="lesson-number">${l.done ? icon("check") : i + 1}</div>
          <div class="lesson-main">
            <div class="lesson-title">
              <h3>
                ${l.teacher === "me" ? "我来教" : "我来学"}：${escape(
                  l.teacher === "me" ? e.teach : e.learn,
                )}
              </h3>
              ${pill(l.done ? "已完成" : "待完成", l.done ? "green" : "")}
            </div>
            <time>${timeText(l.at)}</time>
            <p>${escape(l.goal)}</p>
            ${l.reflection
              ? /* HTML */ `<div class="reflection">
                  学习记录：${escape(l.reflection)}
                </div>`
              : ""}${["scheduled", "learning"].includes(e.status) && !l.done
              ? /* HTML */ `<button
                  class="btn secondary small"
                  data-action="lesson"
                  data-id="${e.id}"
                  data-index="${i}"
                >
                  模拟本节完成${icon("check")}
                </button>`
              : ""}
          </div>
        </article>`,
    )
    .join(
      "",
    )}</div><details class="preparation"><summary>上课前可以准备什么</summary><ul>${p.lesson.prepare.map((item) => `<li>${escape(item)}</li>`).join("")}</ul><p>我来教的部分：准备一份围绕“${escape(e.lessons[0].goal)}”的示例，先确认伙伴的基础。</p><a class="text-btn" href="#/person/${p.id}">查看伙伴的完整教学安排${icon("arrow")}</a></details><p class="fine-print align-left">课程与完成状态用于演示，不会创建真实会议或出勤记录。</p></section>${
    e.status === "review"
      ? /* HTML */ `<form id="review-form" data-id="${e.id}" class="panel">
          <h2>这次交换，收获了什么？</h2>
          <p class="subtle">记录一次小小的进步，也给伙伴一点反馈。</p>
          <div class="form-error" role="alert"></div>
          <fieldset>
            <legend>总体评分</legend>
            <div class="rating-options">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) =>
                    /* HTML */ `<label
                      ><input
                        type="radio"
                        name="rating"
                        value="${n}"
                        ${n === 5 ? "checked" : ""}
                      /><span>${n}${icon("star")}</span></label
                    >`,
                )
                .join("")}
            </div>
          </fieldset>
          ${field(
            "我的学习收获",
            /* HTML */ `<textarea
              name="text"
              required
              maxlength="300"
              placeholder="具体学会了什么？哪种讲解对你有帮助？"
            ></textarea>`,
          )}${checkboxGroup(
            "tags",
            ["讲解清楚", "耐心友好", "目标达成"],
            [],
          )}<button class="btn primary" type="submit">
            提交评价，完成交换${icon("check")}
          </button>
        </form>`
      : ""
  }${
    e.review
      ? /* HTML */ `<section class="panel">
          <span class="eyebrow">交换已完成</span>
          <h2>把学到的，带进生活里</h2>
          <div class="review-sample">
            <span class="stars">${"★".repeat(e.review.rating)}</span>
            <p>${escape(e.review.text)}</p>
            <div class="tag-list">
              ${e.review.tags.map((t) => pill(t)).join("")}
            </div>
            <small>我的本地演示评价</small>
          </div>
        </section>`
      : ""
  }<section class="panel"><h2>课前沟通 <span class="sample">模拟对话</span></h2><p class="subtle">选择问题查看伙伴的示例回复。自由留言仅保存到本机，不会发送给真实用户。</p>${!end ? `<div class="conversation-prompts">${Object.entries(DEMO_QUESTIONS).map(([topic, label]) => `<button class="btn secondary small" data-action="demo-question" data-id="${e.id}" data-topic="${topic}" ${e.messages.some((m) => m.demoTopic === topic) ? 'disabled title="已在下方回复"' : ""}>${escape(label)}</button>`).join("")}</div>` : ""}<div class="messages">${e.messages
    .map(
      (m) =>
        /* HTML */ `<div class="message ${m.by === "me" ? "mine" : ""}">
          <span
            >${m.by === "me"
              ? "我"
              : escape(e.personName) + " · 模拟回复"}</span
          >
          <p>${escape(m.text)}</p>
          <small>${timeText(m.at)}</small>
        </div>`,
    )
    .join(
      "",
    )}</div>${!end ? /* HTML */ `<form id="message-form" data-id="${e.id}" class="message-form"><label class="sr-only" for="message-input">写下留言</label><input id="message-input" name="text" required maxlength="300" placeholder="写下想交流的问题…" /><button class="btn primary" aria-label="保存演示留言">${icon("arrow")}</button></form>` : ""}</section></div><aside class="panel exchange-aside"><h2>交换约定</h2><div class="person-line">${avatar(p)}<div><strong>${escape(p.name)}</strong><span>演示伙伴</span></div></div><dl class="agreement"><dt>我分享</dt><dd>${escape(e.teach)}</dd><dt>我学习</dt><dd>${escape(e.learn)}</dd><dt>交流方式</dt><dd>${escape(e.format)}</dd><dt>交换费用</dt><dd>免费，双方各分享45分钟</dd></dl><p class="subtle">约定已保存，之后修改个人技能不会改变本次交换。</p>${!end ? /* HTML */ `<button class="text-btn danger" data-action="cancel" data-id="${e.id}">${e.status === "pending" ? "撤回邀请" : "取消交换"}</button>` : ""}</aside></div>`;
}
function profile() {
  const m = state.me;
  return /* HTML */ `<div class="page-heading">

      <h1>我的SkillPal</h1>
    </div>
    <div class="profile-summary panel">
      ${avatar(m, "xl")}
      <div>
        <h2>${escape(m.name)}</h2>
        <p>${escape(m.bio)}</p>
        <span class="demo-label">本地演示身份</span>
      </div>
      <button class="btn secondary" data-action="edit-profile">
        ${icon("edit")}编辑资料
      </button>
    </div>
    <section class="panel">
      <div class="section-heading compact">
        <h2>我的技能供需</h2>
        <span
          class="status ${m.active ? "status-scheduled" : "status-cancelled"}"
          >${m.active ? "展示中" : "已暂停"}</span
        >
      </div>
      <div class="profile-skills">
        <div>
          <span class="role teach">我能教</span>
          <h3>${escape(m.teach.join("、"))}</h3>
          <p>${escape(m.goal)}</p>
        </div>
        <span class="swap-large">${icon("match")}</span>
        <div>
          <span class="role want">我想学</span>
          <h3>${escape(m.want.join("、"))}</h3>
          <p>${escape(m.learnGoal)}</p>
        </div>
      </div>
      <div class="tag-list">
        ${m.slots.map((s) => pill(slotLabel(s))).join("")}
      </div>
      <div class="panel-actions">
        <a class="btn primary" href="#/publish">编辑技能供需${icon("edit")}</a
        ><button class="btn secondary" data-action="toggle-active">
          ${m.active ? "暂停展示" : "重新发布"}</button
        ><a class="text-btn" href="#/exchanges">查看交换记录${icon("arrow")}</a>
      </div>
    </section>
    <div class="section-heading">
      <h2>
        收藏的伙伴<span class="count-label">${state.favorites.length}</span>
      </h2>
    </div>
    ${state.favorites.length
      ? /* HTML */ `<div class="card-grid">
          ${PEOPLE.filter((p) => state.favorites.includes(p.id))
            .map((p) => card(p))
            .join("")}
        </div>`
      : /* HTML */ `<div class="empty compact-empty">
          ${icon("heart")}
          <p>遇到想认识的伙伴，先收藏起来。</p>
          <a class="text-btn" href="#/discover">去发现技能${icon("arrow")}</a>
        </div>`}
    <section class="demo-settings">
      <div>
        <strong>关于这个演示</strong>
        <p>
          人物与经历是示例，操作仅保存在当前浏览器。你可以随时恢复初始体验。
        </p>
      </div>
      <button class="btn secondary" data-action="reset">重置演示</button>
    </section>`;
}
function render() {
  const focused = document.activeElement;
  const focusSelector = focused?.id
    ? `#${CSS.escape(focused.id)}`
    : focused?.dataset?.action
      ? `[data-action="${CSS.escape(focused.dataset.action)}"]${focused.dataset.id ? `[data-id="${CSS.escape(focused.dataset.id)}"]` : ""}${focused.dataset.value ? `[data-value="${CSS.escape(focused.dataset.value)}"]` : ""}`
      : null;
  let content;
  const [part, idRaw] = route().slice(1).split("/"),
    id = idRaw?.split("?")[0];
  const p = PEOPLE.find((p) => p.id === id),
    e = state.exchanges.find((e) => e.id === id);
  try {
    content =
      part === "discover"
        ? discover()
        : part === "matches"
          ? matching()
          : part.startsWith("publish")
            ? publish()
            : part === "person" && p
              ? detail(p)
              : part === "invite" && p
                ? invite(p)
                : part === "exchanges"
                  ? exchanges()
                  : part === "exchange" && e
                    ? exchangeDetail(e)
                    : part === "profile"
                      ? profile()
                      : empty(
                          "这个页面暂时找不到",
                          "回到发现页，继续寻找想学的技能。",
                        );
  } catch (err) {
    console.error(err);
    content = empty(
      "页面暂时没有准备好",
      "可以回到发现页重试，或在我的页面重置演示。",
    );
  }
  app.innerHTML =
    header() +
    /* HTML */ `<main id="main" data-view="${escape(part)}" tabindex="-1">
      <div
        id="save-warning"
        class="notice save-notice"
        role="alert"
        ${storageFailed ? "" : "hidden"}
      >
        当前无法保存到浏览器。本次操作仍可继续，但刷新或关闭页面后将不保留。
      </div>
      ${content}
      <footer>
        <span class="footer-brand">SkillPal</span
        ><span>技能互换产品演示</span>
      </footer>
    </main>`;
  if (focusSelector)
    document.querySelector(focusSelector)?.focus({ preventScroll: true });
  document.title = `${{ discover: "发现技能", matches: "我的匹配", exchanges: "我的交换", profile: "我的", publish: "发布技能", person: "伙伴详情", invite: "发起交换", exchange: "交换详情" }[part] || "技能互换"} · SkillPal`;
}
function captureDraft(form) {
  const f = new FormData(form);
  if (step === 1) {
    draft.teach = f.getAll("teach");
    draft.audience = f.get("audience");
    draft.proficiency = f.get("proficiency");
    draft.goal = f.get("goal");
    draft.experience = f.get("experience");
  } else if (step === 2) {
    draft.want = f.getAll("want");
    draft.level = f.get("level");
    draft.learnGoal = f.get("learnGoal");
  } else {
    draft.slots = f.getAll("slots");
    draft.formats = f.getAll("formats");
  }
  state.draft = draft;
  state.draftStep = step;
  persist();
}
function clearFormError(form) {
  form.querySelectorAll(".field-error").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid]").forEach((node) => {
    node.removeAttribute("aria-invalid");
    node.removeAttribute("aria-describedby");
  });
  const region = form.querySelector(".form-error");
  if (region) region.textContent = "";
}
function formError(form, error) {
  clearFormError(form);
  const message = error.message || String(error);
  const rules = [
    [/能教.*技能/, "teach"],
    [/想学.*技能/, "want"],
    [/可用时段/, "slots"],
    [/教学形式/, "formats"],
    [/教学成果/, "goal"],
    [/经验说明/, "experience"],
    [/学习目标/, "learnGoal"],
    [/第二节课/, "time2"],
    [/时间|课程不能重叠/, "time1"],
    [/邀请说明/, "note"],
    [/取消原因/, "reason"],
    [/收获|评分/, "text"],
  ];
  const name = rules.find(([pattern]) => pattern.test(message))?.[1];
  const input = name ? form.querySelector(`[name="${name}"]`) : null;
  const region = form.querySelector(".form-error");
  if (region) region.textContent = message;
  if (input) {
    const group = input.closest("fieldset") || input.closest(".field");
    if (group) {
      const hint = document.createElement("div");
      hint.className = "field-error";
      hint.id = `error-${name}`;
      hint.textContent = message;
      group.append(hint);
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", hint.id);
      input.focus();
      group.scrollIntoView({ block: "center" });
    }
  } else if (region) {
    region.setAttribute("tabindex", "-1");
    region.focus();
    region.scrollIntoView({ block: "nearest" });
  } else toast(message);
}
function showDialog(title, body, formId, extra = "") {
  dialog.innerHTML = /* HTML */ `<form id="${formId}" ${extra}>
    <div class="dialog-heading">
      <h2>${title}</h2>
      <button
        type="button"
        class="icon-button"
        data-action="close-dialog"
        aria-label="关闭"
      >
        ${icon("close")}
      </button>
    </div>
    <div class="form-error" role="alert"></div>
    ${body}
  </form>`;
  dialog.showModal();
}
document.addEventListener("click", (ev) => {
  if (ev.target.closest(".skip")) {
    ev.preventDefault();
    document.querySelector("#main")?.focus();
    return;
  }
  const button = ev.target.closest("[data-action]");
  if (!button) return;
  const a = button.dataset.action,
    id = button.dataset.id,
    e = state.exchanges.find((x) => x.id === id);
  try {
    if (a === "favorite") {
      state.favorites = state.favorites.includes(id)
        ? state.favorites.filter((x) => x !== id)
        : [...state.favorites, id];
      persist();
      const saved = state.favorites.includes(id);
      render();
      toast(saved ? "已收藏伙伴" : "已取消收藏");
    } else if (a === "category") {
      filter.category = button.dataset.value;
      render();
    } else if (a === "clear-search") {
      filter.q = "";
      render();
    } else if (a === "exchange-tab") {
      exchangeTab = button.dataset.value;
      render();
    } else if (a === "back") {
      go(
        route().startsWith("/exchange/")
          ? "/exchanges"
          : route().startsWith("/invite/")
            ? "/person/" + route().split("/")[2]
            : route().startsWith("/person/")
              ? personReturnRoutes.get(route().split("/")[2]) || "/discover"
              : "/discover",
      );
    } else if (a === "previous-step") {
      captureDraft(document.querySelector("#publish-form"));
      step--;
      state.draftStep = step;
      persist();
      render();
      window.scrollTo(0, 0);
    } else if (a === "demo-question") {
      askDemoQuestion(e, button.dataset.topic);
      persist();
      render();
      const reply = document.querySelector(".messages .message:last-child");
      if (reply) {
        reply.setAttribute("tabindex", "-1");
        reply.focus({ preventScroll: true });
        reply.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    } else if (a === "accept" || a === "decline") {
      transition(e, a);
      persist();
      render();
      toast(
        a === "accept" ? "已模拟接受邀请，课程安排已确认" : "已模拟拒绝邀请",
      );
    } else if (a === "lesson") {
      showDialog(
        "记录这节课的小收获",
        `${field("学习记录，可选", '<textarea name="reflection" maxlength="200" placeholder="记下一件学会的事…"></textarea>')}<p class="subtle">这是演示操作，不代表真实课程已经发生。</p><button class="btn primary full">确认模拟完成</button>`,
        "lesson-form",
        `data-id="${id}" data-index="${button.dataset.index}"`,
      );
    } else if (a === "cancel") {
      showDialog(
        "取消这次交换",
        `${field("取消原因", '<textarea name="reason" required maxlength="200" placeholder="例如：时间安排发生变化"></textarea>')}<p class="subtle">已完成的课程与学习记录会保留。</p><button class="btn danger-btn full">确认取消</button>`,
        "cancel-form",
        `data-id="${id}"`,
      );
    } else if (a === "close-dialog") dialog.close();
    else if (a === "toggle-active") {
      state.me.active = !state.me.active;
      persist();
      render();
      toast(state.me.active ? "技能已重新发布" : "技能已暂停展示");
    } else if (a === "edit-profile") {
      showDialog(
        "编辑个人资料",
        `${field("昵称", /* HTML */ `<input name="name" required maxlength="12" value="${escape(state.me.name)}" />`)}${field("个人介绍", /* HTML */ `<textarea name="bio" required maxlength="150">${escape(state.me.bio)}</textarea>`)}<button class="btn primary full">保存资料</button>`,
        "profile-form",
      );
    } else if (a === "reset") {
      showDialog(
        "重新开始一次体验？",
        '<p>将清除本机保存的发布、邀请、收藏和评价，恢复初始演示数据。此操作不能撤销。</p><div class="form-actions"><button type="button" class="btn secondary" data-action="close-dialog">保留数据</button><button class="btn danger-btn">确认重置</button></div>',
        "reset-form",
      );
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.closest("#publish-form")) captureDraft(t.closest("form"));
  if (t.id === "format-filter") {
    filter.format = t.value;
    render();
  }
  if (t.id === "slot-filter") {
    filter.slot = t.value;
    render();
  }
  if (t.id === "mutual-filter") {
    filter.mutual = t.checked;
    render();
  }
});
document.addEventListener("input", (ev) => {
  if (ev.target.closest("#publish-form"))
    captureDraft(ev.target.closest("form"));
});
document.addEventListener("submit", (ev) => {
  const form = ev.target;
  ev.preventDefault();
  const f = new FormData(form);
  clearFormError(form);
  try {
    if (form.id === "search-form") {
      filter.q = f.get("q").trim();
      go("/discover");
    } else if (form.id === "publish-form") {
      captureDraft(form);
      if (step === 1) {
        if (!draft.teach.length || draft.teach.length > 3)
          throw Error("请选择1至3项能教的技能。");
        if (!draft.goal.trim() || !draft.experience.trim())
          throw Error("请填写教学成果和经验说明。");
      }
      if (step === 2) {
        if (!draft.want.length || draft.want.length > 3)
          throw Error("请选择1至3项想学的技能。");
        if (!draft.learnGoal.trim()) throw Error("请填写学习目标。");
      }
      if (step < 3) {
        step++;
        state.draftStep = step;
        persist();
        render();
        window.scrollTo(0, 0);
      } else {
        validatePost(draft);
        state.me = { ...state.me, ...draft, active: true, published: true };
        state.draft = null;
        state.draftStep = 1;
        draft = null;
        step = 1;
        persist();
        const returnId = new URLSearchParams(route().split("?")[1] || "").get(
          "return",
        );
        go(returnId ? "/person/" + returnId : "/matches");
        toast("技能已发布，看看谁和你互相需要");
      }
    } else if (form.id === "invite-form") {
      const p = PEOPLE.find((p) => p.id === form.dataset.person);
      const e = createExchange(state, p, {
        teach: f.get("teach"),
        learn: f.get("learn"),
        format: f.get("format"),
        note: f.get("note"),
        times: [f.get("time1"), f.get("time2")].map((t) =>
          new Date(`${t}:00+08:00`).toISOString(),
        ),
      });
      persist();
      go("/exchange/" + e.id);
      toast("演示邀请已保存");
    } else if (
      form.id === "lesson-form" ||
      form.id === "cancel-form" ||
      form.id === "review-form"
    ) {
      const e = state.exchanges.find((e) => e.id === form.dataset.id);
      if (form.id === "lesson-form")
        transition(e, "completeLesson", {
          index: Number(form.dataset.index),
          reflection: f.get("reflection"),
        });
      if (form.id === "cancel-form")
        transition(e, "cancel", { reason: f.get("reason") });
      if (form.id === "review-form")
        transition(e, "review", {
          rating: Number(f.get("rating")),
          text: f.get("text"),
          tags: f.getAll("tags"),
        });
      persist();
      dialog.close();
      render();
      toast(
        form.id === "review-form"
          ? "交换完成，把学到的带进生活里"
          : form.id === "cancel-form"
            ? "交换已取消，已有记录已保留"
            : "本节已模拟完成",
      );
    } else if (form.id === "message-form") {
      const e = state.exchanges.find((e) => e.id === form.dataset.id);
      const text = f.get("text").trim();
      if (!text) throw Error("请先写下留言。");
      e.messages.push({
        by: "me",
        text: text.slice(0, 300),
        at: new Date().toISOString(),
      });
      persist();
      render();
      toast("留言已保存到本机");
    } else if (form.id === "profile-form") {
      if (!f.get("name").trim() || !f.get("bio").trim())
        throw Error("昵称与介绍不能为空。");
      state.me.name = f.get("name").trim();
      state.me.bio = f.get("bio").trim();
      if (draft) {
        draft.name = state.me.name;
        draft.bio = state.me.bio;
      }
      persist();
      dialog.close();
      render();
      toast("资料已保存");
    } else if (form.id === "reset-form") {
      state = initialState();
      draft = null;
      step = 1;
      filter = { q: "", category: "全部", format: "", slot: "", mutual: false };
      persist();
      dialog.close();
      go("/discover");
      toast("已恢复初始演示");
    }
  } catch (err) {
    formError(form, err);
  }
});
app.addEventListener("click", (ev) => {
  const a = ev.target.closest('a[href="#/discover"]');
  if (a && a.closest(".empty")) {
    filter = { q: "", category: "全部", format: "", slot: "", mutual: false };
    render();
  }
});
window.addEventListener("hashchange", () => {
  const currentRoute = route();
  if (currentRoute.startsWith("/person/") && /^\/(discover|matches|profile|exchange\/)/.test(previousRoute)) {
    personReturnRoutes.set(currentRoute.split("/")[2], previousRoute);
  }
  previousRoute = currentRoute;
  history.replaceState({ skillpal: true }, "");
  dialog.close();
  render();
  window.scrollTo(0, 0);
  document.querySelector("#main").focus({ preventScroll: true });
});
render();
if (loaded.warning) toast(loaded.warning);
