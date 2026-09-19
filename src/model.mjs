import {
  initialState,
  SKILLS,
  SLOT_OPTIONS,
  LEVELS,
  FORMATS,
  PEOPLE,
} from "../data/seed.mjs";
export const STORAGE_KEY = "skillpal-demo-v1";
export const STATUS = {
  pending: "待回应",
  scheduled: "已约定",
  learning: "交换中",
  review: "待评价",
  completed: "已完成",
  declined: "已拒绝",
  cancelled: "已取消",
};
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: initialState() };
    const s = JSON.parse(raw);
    if (
      s.version !== 1 ||
      !s.me ||
      !Array.isArray(s.exchanges) ||
      !Array.isArray(s.favorites)
    )
      throw Error();
    validatePost(s.me);
    validateSavedState(s);
    if (s.draft) {
      const restored = restoreDraft(s.draft, s.me);
      if (!restored) {
        s.draft = null;
        s.draftStep = 1;
        return { state: s, warning: "未完成的草稿无法读取，已清除草稿。已发布资料、收藏和交换记录均保留。" };
      }
      s.draft = restored;
      s.draftStep = [1, 2, 3].includes(s.draftStep) ? s.draftStep : 1;
    }
    return { state: s };
  } catch {
    return {
      state: initialState(),
      warning: "本地数据不可读取，已恢复演示。新的操作将重新保存。",
    };
  }
}
// Drafts can be incomplete; validate their shape without requiring a publishable post.
function restoreDraft(raw, me) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const draft = structuredClone(me);
  for (const [key, options] of [["teach", Object.keys(SKILLS)], ["want", Object.keys(SKILLS)], ["slots", SLOT_OPTIONS], ["formats", FORMATS]]) {
    if (!Array.isArray(raw[key]) || raw[key].some((value) => !options.includes(value))) return null;
    draft[key] = [...new Set(raw[key])];
  }
  for (const key of ["goal", "learnGoal", "experience"]) {
    if (typeof raw[key] !== "string" || raw[key].length > 200) return null;
    draft[key] = raw[key];
  }
  if (!LEVELS.includes(raw.level) || !LEVELS.includes(raw.audience)) return null;
  draft.level = raw.level;
  draft.audience = raw.audience;
  draft.proficiency = ["熟悉", "熟练"].includes(raw.proficiency) ? raw.proficiency : "熟练";
  return draft;
}
function validateSavedState(s) {
  const ids = new Set(PEOPLE.map((p) => p.id));
  if (
    typeof s.me.name !== "string" ||
    !s.me.name.trim() ||
    typeof s.me.bio !== "string" ||
    s.favorites.some((id) => !ids.has(id))
  )
    throw Error("Invalid profile");
  for (const e of s.exchanges) {
    if (
      !e.id ||
      !ids.has(e.personId) ||
      !STATUS[e.status] ||
      !SKILLS[e.teach] ||
      !SKILLS[e.learn] ||
      !Array.isArray(e.lessons) ||
      e.lessons.length !== 2 ||
      !Array.isArray(e.messages)
    )
      throw Error("Invalid exchange");
    if (
      e.lessons.some(
        (l) =>
          !Number.isFinite(Date.parse(l.at)) ||
          typeof l.done !== "boolean" ||
          typeof l.goal !== "string",
      ) ||
      e.messages.some(
        (m) => typeof m.text !== "string" || !Number.isFinite(Date.parse(m.at)),
      )
    )
      throw Error("Invalid lesson");
    if (
      e.review &&
      (!Array.isArray(e.review.tags) ||
        typeof e.review.text !== "string" ||
        !Number.isInteger(e.review.rating) ||
        e.review.rating < 1 ||
        e.review.rating > 5)
    )
      throw Error("Invalid review");
  }
}
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export const intersection = (a, b) => a.filter((x) => b.includes(x));
export function match(me, p) {
  const teach = intersection(me.teach, p.want),
    learn = intersection(me.want, p.teach),
    formats = intersection(me.formats, p.formats),
    slots = intersection(me.slots, p.slots);
  const fit = (p.audience === me.level) + (me.audience === p.level);
  return {
    eligible: !!(
      me.published &&
      me.active &&
      p.active &&
      teach.length &&
      learn.length &&
      formats.length
    ),
    teach,
    learn,
    formats,
    slots,
    fit,
  };
}
export function matches(me, people) {
  return people
    .map((p) => ({ person: p, ...match(me, p) }))
    .filter((m) => m.eligible)
    .sort(
      (a, b) =>
        Number(!!b.slots.length) - Number(!!a.slots.length) ||
        b.fit - a.fit ||
        b.slots.length - a.slots.length ||
        a.person.id.localeCompare(b.person.id),
    );
}
export function validatePost(p) {
  for (const key of ["teach", "want"])
    if (
      !Array.isArray(p[key]) ||
      p[key].length < 1 ||
      p[key].length > 3 ||
      p[key].some((x) => !SKILLS[x])
    )
      throw Error("能教与想学的技能分别选择1至3项。");
  for (const [k, label] of [
    ["goal", "教学成果"],
    ["learnGoal", "学习目标"],
    ["experience", "经验说明"],
  ])
    if (!p[k]?.trim() || p[k].length > 200)
      throw Error(`请填写${label}，不超过200字。`);
  if (
    !Array.isArray(p.slots) ||
    !p.slots.length ||
    p.slots.some((x) => !SLOT_OPTIONS.includes(x))
  )
    throw Error("至少选择一个可用时段。");
  if (
    !Array.isArray(p.formats) ||
    !p.formats.length ||
    p.formats.some((x) => !FORMATS.includes(x))
  )
    throw Error("至少选择一种教学形式。");
  if (!LEVELS.includes(p.level) || !LEVELS.includes(p.audience))
    throw Error("请选择学习基础。");
}
export function beijingDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function upcoming(slots, now = new Date()) {
  const dates = [];
  const base = beijingDate(now);
  for (let i = 0; i < 14; i++) {
    const d = new Date(`${base}T00:00:00+08:00`);
    d.setUTCDate(d.getUTCDate() + i);
    const day = new Date(`${beijingDate(d)}T12:00:00+08:00`).getUTCDay();
    for (const slot of slots) {
      const [weekday, time] = slot.split("-");
      if (Number(weekday) !== day) continue;
      const iso = new Date(`${beijingDate(d)}T${time}:00+08:00`);
      if (iso > now) dates.push(iso.toISOString());
    }
  }
  return dates.sort();
}
export const overlaps = (a, b) =>
  Math.abs(new Date(a) - new Date(b)) < 45 * 60000;
const isOpenExchange = (e) => !["cancelled", "declined", "completed"].includes(e.status);
export function availableLessonTimes(state, slots, now = new Date()) {
  const reserved = state.exchanges.filter(isOpenExchange).flatMap((e) => e.lessons.filter((l) => !l.done));
  const selected = [];
  for (const at of upcoming(slots, now)) {
    if (reserved.some((l) => overlaps(at, l.at)) || selected.some((other) => overlaps(at, other))) continue;
    selected.push(at);
  }
  return selected;
}
export function createExchange(state, p, input, now = new Date()) {
  if (!state.me.active || !state.me.published || !p.active)
    throw Error("请先发布或重新上架自己的技能。");
  const m = match(state.me, p);
  if (!m.eligible)
    throw Error("双方技能或教学形式尚未互补，请先调整发布内容。");
  if (
    !m.teach.includes(input.teach) ||
    !m.learn.includes(input.learn) ||
    !m.formats.includes(input.format)
  )
    throw Error("请选择双方可以交换的技能和教学形式。");
  if (!input.note?.trim()) throw Error("请写一句邀请说明。");
  if (
    state.exchanges.some(
      (e) =>
        e.personId === p.id &&
        e.teach === input.teach &&
        e.learn === input.learn &&
        !["cancelled", "declined", "completed"].includes(e.status),
    )
  )
    throw Error("你们已有这组技能的有效邀请，请到我的交换查看。");
  const times = input.times;
  if (
    !Array.isArray(times) ||
    times.length !== 2 ||
    times.some((t) => !Number.isFinite(Date.parse(t)) || new Date(t) <= now)
  )
    throw Error("请选择两个未来的课程时间。");
  if (times.some((t) => new Date(t) > new Date(now.getTime() + 14 * 86400000)))
    throw Error("请选择未来14天内的课程时间。");
  if (overlaps(times[0], times[1])) throw Error("两节45分钟课程不能重叠。");
  if (new Date(times[1]) < new Date(times[0])) throw Error("第二节课应安排在第一节课之后。");
  if (
    state.exchanges
      .filter((e) => !["cancelled", "declined", "completed"].includes(e.status))
      .some((e) =>
        e.lessons.some((l) => !l.done && times.some((t) => overlaps(t, l.at))),
      )
  )
    throw Error("这个时间已有其他交换安排，请换一个时段。");
  const id = globalThis.crypto?.randomUUID?.() ?? `exchange-${now.getTime()}`;
  const e = {
    id,
    personId: p.id,
    personName: p.name,
    teach: input.teach,
    learn: input.learn,
    format: input.format,
    note: input.note.trim().slice(0, 300),
    status: "pending",
    createdAt: now.toISOString(),
    lessons: [
      { at: times[0], teacher: "me", goal: state.me.goal, done: false },
      { at: times[1], teacher: p.id, goal: p.goal, done: false },
    ],
    messages: [
      {
        by: "me",
        text: input.note.trim().slice(0, 300),
        at: now.toISOString(),
      },
    ],
    review: null,
  };
  state.exchanges.unshift(e);
  return e;
}
export const DEMO_QUESTIONS = {
  preparation: "我要准备什么？",
  scope: "这次能学到什么？",
  needs: "你想重点练什么？",
};
export function askDemoQuestion(e, topic, now = new Date()) {
  if (!["pending", "scheduled", "learning", "review"].includes(e.status))
    throw Error("这次交换已结束，不能继续模拟问答。");
  const person = PEOPLE.find((p) => p.id === e.personId);
  if (!person || !Object.hasOwn(DEMO_QUESTIONS, topic)) throw Error("请选择一个有效的课前问题。");
  if (e.messages.some((m) => m.demoTopic === topic)) throw Error("这个问题已有回复，可以在交流记录中查看。");
  const replies = {
    preparation: person.lesson.prepare.join("；") + "。" + person.context.style,
    scope: e.lessons[1].goal + "。" + person.context.boundary,
    needs: person.context.purpose + "目前卡在这里：" + person.context.obstacle,
  };
  e.messages.push(
    { by: "me", text: DEMO_QUESTIONS[topic], at: now.toISOString(), demoTopic: topic },
    { by: "partner", text: replies[topic], at: now.toISOString(), demo: true, demoTopic: topic },
  );
  return e;
}
export function transition(e, action, payload = {}) {
  if (action === "accept" || action === "decline") {
    if (e.status !== "pending") throw Error("这条邀请已经处理。");
    e.status = action === "accept" ? "scheduled" : "declined";
    e.messages.push({
      by: "partner",
      text:
        action === "accept"
          ? PEOPLE.find((p) => p.id === e.personId)?.context.acceptNote || "邀请收到，两个时间都可以。我们先确认这次的学习目标。"
          : "这次时间不太合适，期待下次一起学习。",
      at: new Date().toISOString(),
      demo: true,
    });
  } else if (action === "cancel") {
    if (["completed", "declined", "cancelled"].includes(e.status))
      throw Error("这次交换已经结束。");
    if (!payload.reason?.trim()) throw Error("请填写取消原因。");
    e.status = "cancelled";
    e.reason = payload.reason.trim().slice(0, 200);
  } else if (action === "completeLesson") {
    if (!["scheduled", "learning"].includes(e.status))
      throw Error("请先确认交换安排。");
    const lesson = e.lessons[payload.index];
    if (!lesson || lesson.done) throw Error("这节课程已经完成或不存在。");
    lesson.done = true;
    lesson.reflection = (payload.reflection || "").slice(0, 200);
    lesson.completedAt = new Date().toISOString();
    e.status = e.lessons.every((l) => l.done) ? "review" : "learning";
  } else if (action === "review") {
    if (e.status !== "review" || e.review)
      throw Error("两节课程都完成后才能评价，且只能评价一次。");
    if (
      !Number.isInteger(payload.rating) ||
      payload.rating < 1 ||
      payload.rating > 5 ||
      !payload.text?.trim()
    )
      throw Error("请选择评分并写下学习收获。");
    e.review = {
      rating: payload.rating,
      text: payload.text.trim().slice(0, 300),
      tags: payload.tags || [],
      at: new Date().toISOString(),
    };
    e.status = "completed";
  } else throw Error("不支持的操作。");
  return e;
}
