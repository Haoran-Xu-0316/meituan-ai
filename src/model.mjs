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
  rescheduling: "待协商补课",
  review: "待评价",
  completed: "已完成",
  declined: "已拒绝",
  cancelled: "已取消",
};
export function exchangeActions(exchange, now = new Date()) {
  const status = exchange.status;
  const active = ["pending", "scheduled", "learning", "rescheduling", "review"].includes(status);
  return {
    respond: status === "pending",
    accept: status === "pending" && exchange.lessons.every((lesson) => new Date(lesson.at) > now),
    communicate: active,
    reschedule: ["pending", "scheduled", "learning", "rescheduling"].includes(status),
    cancel: ["pending", "scheduled", "learning"].includes(status),
    settle: status === "rescheduling",
    review: status === "review",
    completeLesson: exchange.lessons.map((lesson, index) =>
      ["scheduled", "learning"].includes(status) && !lesson.done && exchange.lessons.slice(0, index).every((prior) => prior.done)),
  };
}
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
    const removedExchanges = validateSavedState(s);
    const warnings = removedExchanges ? [`有${removedExchanges}条交换记录无法读取，已单独移除；其他记录、资料和收藏均保留。`] : [];
    if (Object.hasOwn(s, "inviteDrafts")) s.inviteDrafts = restoreInviteDrafts(s.inviteDrafts);
    if (s.draft) {
      const restored = restoreDraft(s.draft, s.me);
      if (!restored) {
        s.draft = null;
        s.draftStep = 1;
        warnings.push("未完成的草稿无法读取，已清除草稿。已发布资料、收藏和正常交换记录均保留。");
      } else {
        s.draft = restored;
        s.draftStep = [1, 2, 3].includes(s.draftStep) ? s.draftStep : 1;
      }
    }
    return warnings.length ? { state: s, warning: warnings.join(" ") } : { state: s };
  } catch {
    return {
      state: initialState(),
      warning: "本地数据不可读取，已恢复演示。新的操作将重新保存。",
    };
  }
}
// Invitation drafts are isolated by partner and never count as an exchange.
const inviteDraftLimits = { teach: 40, learn: 40, format: 40, teachGoal: 200, learnGoal: 200, time1: 16, time2: 16, note: 300 };
function validInviteDraft(raw) {
  return raw && typeof raw === "object" && !Array.isArray(raw) &&
    Object.entries(inviteDraftLimits).every(([key, limit]) =>
      typeof raw[key] === "string" && raw[key].length <= limit) &&
    [raw.time1, raw.time2].every(value => value === "" ||
      (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}:00+08:00`))));
}
function restoreInviteDrafts(raw) {
  const drafts = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return drafts;
  for (const p of PEOPLE) {
    if (Object.hasOwn(raw, p.id) && validInviteDraft(raw[p.id]))
      drafts[p.id] = Object.fromEntries(Object.keys(inviteDraftLimits).map(key => [key, raw[p.id][key]]));
  }
  return drafts;
}
export function saveInviteDraft(state, p, values) {
  if (!PEOPLE.some(person => person.id === p.id) || !validInviteDraft(values)) return false;
  state.inviteDrafts = restoreInviteDrafts(state.inviteDrafts);
  state.inviteDrafts[p.id] = Object.fromEntries(Object.keys(inviteDraftLimits).map(key => [key, values[key]]));
  return true;
}
export function readInviteDraft(state, p) {
  const saved = state.inviteDrafts?.[p.id];
  if (!validInviteDraft(saved)) return null;
  const draft = { ...saved }, m = match(state.me, p);
  for (const key of ["teach", "learn"]) {
    if (!m[key].includes(draft[key])) {
      draft[key] = m[key][0] || "";
      draft[`${key}Goal`] = "";
    }
  }
  if (!m.formats.includes(draft.format)) draft.format = m.formats[0] || "";
  return draft;
}
function invitationError(message, field) {
  return Object.assign(new Error(message), { field });
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
  // One damaged agreement must not erase unrelated local work.
  const seen = new Set();
  const originalCount = s.exchanges.length;
  s.exchanges = s.exchanges.filter((exchange) => {
    try {
      validateSavedExchange(exchange, ids);
      if (seen.has(exchange.id)) return false;
      seen.add(exchange.id);
      return true;
    } catch {
      return false;
    }
  });
  return originalCount - s.exchanges.length;
}
function validateSavedExchange(e, partnerIds) {
  if (!e || typeof e.id !== "string" || !e.id ||
    !partnerIds.has(e.personId) || !Object.hasOwn(STATUS, e.status) ||
    !Object.hasOwn(SKILLS, e.teach) || !Object.hasOwn(SKILLS, e.learn) ||
    !FORMATS.includes(e.format) || !Array.isArray(e.lessons) ||
    e.lessons.length !== 2 || !Array.isArray(e.messages))
    throw Error("Invalid exchange");
  if (e.lessons.some((lesson, index) =>
    !lesson || !Number.isFinite(Date.parse(lesson.at)) ||
    lesson.teacher !== (index === 0 ? "me" : e.personId) ||
    typeof lesson.done !== "boolean" || typeof lesson.goal !== "string" || !lesson.goal.trim() ||
    (lesson.goalStatus !== undefined && !["achieved", "needs-help"].includes(lesson.goalStatus)) ||
    (lesson.reflection !== undefined && typeof lesson.reflection !== "string") ||
    (lesson.goalStatus === "needs-help" && !lesson.reflection?.trim()) ||
    (lesson.artifact !== undefined && artifactUrl(lesson.artifact) !== lesson.artifact)) ||
    e.messages.some(message => !message || !["me", "partner"].includes(message.by) ||
      typeof message.text !== "string" || !Number.isFinite(Date.parse(message.at))))
    throw Error("Invalid lesson");
  const done = e.lessons.filter(lesson => lesson.done).length;
  const validCounts = { pending: [0], scheduled: [0], declined: [0], learning: [1], rescheduling: [1], review: [2], completed: [2], cancelled: [0, 1] };
  if (!validCounts[e.status].includes(done) || (e.lessons[1].done && !e.lessons[0].done) ||
    (e.status === "cancelled" && done === 1 && e.resolution !== "mutual-end") ||
    Boolean(e.review) !== (e.status === "completed"))
    throw Error("Inconsistent exchange status");
  if (e.review && (!Array.isArray(e.review.tags) ||
    e.review.tags.some(tag => !["讲解清楚", "耐心友好", "目标达成"].includes(tag)) ||
    (e.review.tags.includes("目标达成") && e.lessons.some(lesson => lesson.goalStatus === "needs-help")) ||
    typeof e.review.text !== "string" || !Number.isInteger(e.review.rating) ||
    e.review.rating < 1 || e.review.rating > 5))
    throw Error("Invalid review");
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
// Existing agreements stay reachable even when either profile changes afterward.
export function partnerAction(state, person) {
  const labels = { pending: "查看邀请", scheduled: "继续交换", learning: "继续交换", rescheduling: "安排补课", review: "记录评价" };
  const existing = state.exchanges.find(exchange => exchange.personId === person.id && Object.hasOwn(labels, exchange.status));
  if (existing) return { path: `/exchange/${existing.id}`, label: labels[existing.status] };
  return match(state.me, person).eligible
    ? { path: `/invite/${person.id}`, label: readInviteDraft(state, person) ? "继续填写邀请" : "发起交换" }
    : { path: `/publish?return=${person.id}`, label: "调整供需后交换" };
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
  const reserved = state.exchanges.filter((e) => isOpenExchange(e) && e.status !== "rescheduling").flatMap((e) => e.lessons.filter((l) => !l.done));
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
  for (const [field, options] of [["teach", m.teach], ["learn", m.learn], ["format", m.formats]]) {
    if (!options.includes(input[field]))
      throw invitationError("请选择双方可以交换的技能和教学形式。", field);
  }
  if (!input.note?.trim()) throw invitationError("请写一句邀请说明。", "note");
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
  if (!Array.isArray(input.times) || input.times.length !== 2)
    throw invitationError("请选择两个未来的课程时间。", "time1");
  input.times.forEach((time, index) => {
    if (!Number.isFinite(Date.parse(time)) || new Date(time) <= now)
      throw invitationError("请选择两个未来的课程时间。", `time${index + 1}`);
    if (new Date(time) > new Date(now.getTime() + 14 * 86400000))
      throw invitationError("请选择未来14天内的课程时间。", `time${index + 1}`);
  });
  const times = input.times.map(time => new Date(time).toISOString());
  if (overlaps(times[0], times[1])) throw invitationError("两节45分钟课程不能重叠。", "time2");
  if (new Date(times[1]) < new Date(times[0])) throw invitationError("第二节课应安排在第一节课之后。", "time2");
  times.forEach((time, index) => {
    if (state.exchanges
      .filter(e => !["cancelled", "declined", "completed", "rescheduling"].includes(e.status))
      .some(e => e.lessons.some(lesson => !lesson.done && overlaps(time, lesson.at))))
      throw invitationError("这个时间已有其他交换安排，请换一个时段。", `time${index + 1}`);
  });
  const lessonGoal = (value, fallback, field) => {
    const goal = value === undefined ? fallback : value;
    if (typeof goal !== "string" || !goal.trim() || goal.length > 200)
      throw invitationError("请分别确认所选技能的课程目标，不超过200字。", field);
    return goal.trim();
  };
  const teachGoal = lessonGoal(input.teachGoal, input.teach === state.me.teach[0] ? state.me.goal : "", "teachGoal");
  const learnGoal = lessonGoal(input.learnGoal, input.learn === p.teach[0] ? p.goal : "", "learnGoal");
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
      { at: times[0], teacher: "me", goal: teachGoal, done: false },
      { at: times[1], teacher: p.id, goal: learnGoal, done: false },
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
  if (state.inviteDrafts) delete state.inviteDrafts[p.id];
  return e;
}
// Only explicit web URLs can become clickable learning artifacts.
export function artifactUrl(value) {
  const text = String(value).trim();
  if (!text) return "";
  if (text.length > 1000) throw Error("作品链接过长。");
  let url;
  try { url = new URL(text); } catch { throw Error("作品链接需以https://或http://开头。"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw Error("请填写不含账号密码的http或https作品链接。");
  return url.href;
}
export function rescheduleExchange(state, exchange, times, now = new Date()) {
  if (!exchangeActions(exchange).reschedule)
    throw Error("当前交换不能改期。");
  const remaining = exchange.lessons.filter((l) => !l.done);
  if (!Array.isArray(times) || times.length !== remaining.length)
    throw invitationError("请选择未来14天内的课程时间。", "time1");
  times.forEach((time, index) => {
    if (!Number.isFinite(Date.parse(time)) || new Date(time) <= now || new Date(time) > new Date(now.getTime() + 14 * 86400000))
      throw invitationError("请选择未来14天内的课程时间。", `time${index + 1}`);
  });
  let index = 0;
  const proposed = exchange.lessons.map((l) => l.done ? l.at : times[index++]);
  if (remaining.length === 2 && (overlaps(proposed[0], proposed[1]) || new Date(proposed[1]) < new Date(proposed[0])))
    throw invitationError("两节课需按顺序安排，且相隔至少45分钟。", "time2");
  const otherReservations = state.exchanges
    .filter(e => e.id !== exchange.id && isOpenExchange(e) && e.status !== "rescheduling")
    .flatMap(e => e.lessons.filter(lesson => !lesson.done));
  times.forEach((time, index) => {
    if (otherReservations.some(lesson => overlaps(time, lesson.at)))
      throw invitationError("这个时间已有其他交换安排，请换一个时段。", `time${index + 1}`);
  });
  const awaitingResponse = exchange.status === "pending";
  remaining.forEach((l, i) => { l.at = times[i]; });
  exchange.status = awaitingResponse ? "pending" : exchange.lessons.some((l) => l.done) ? "learning" : "scheduled";
  exchange.messages.push({ by: awaitingResponse ? "me" : "partner", text: awaitingResponse ? "已修改邀请时间，等待对方确认。" : "已模拟双方确认新的课程时间，已完成的分享与成果保持不变。", demo: !awaitingResponse, at: now.toISOString() });
  delete exchange.reason;
}
export const DEMO_QUESTIONS = {
  preparation: "我要准备什么？",
  scope: "这次能学到什么？",
  needs: "你想重点练什么？",
};
export function askDemoQuestion(e, topic, now = new Date()) {
  if (!exchangeActions(e).communicate)
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
export function addExchangeMessage(exchange, text, now = new Date()) {
  if (!exchangeActions(exchange).communicate) throw Error("交换已结束，不能继续留言。");
  if (typeof text !== "string" || !text.trim() || text.length > 300)
    throw Error("请填写1至300字的留言。");
  exchange.messages.push({ by: "me", text: text.trim(), at: now.toISOString() });
}
export function transition(e, action, payload = {}, now = new Date()) {
  const actions = exchangeActions(e, now);
  if (action === "accept" || action === "decline") {
    if (e.status !== "pending") throw Error("这条邀请已经处理。");
    if (action === "accept" && !actions.accept)
      throw Error("邀请中的课程时间已过，请先修改时间再接受。");
    e.status = action === "accept" ? "scheduled" : "declined";
    e.messages.push({
      by: "partner",
      text:
        action === "accept"
          ? `约定收到。我分享${e.learn}：${e.lessons[1].goal}；向你学${e.teach}：${e.lessons[0].goal}`
          : "这次时间不太合适，期待下次一起学习。",
      at: now.toISOString(),
      demo: true,
    });
  } else if (action === "settle") {
    if (!actions.settle) throw Error("只有待协商补课的交换可以协商结束。");
    if (!payload.reason?.trim()) throw Error("请记录双方同意结束的原因。");
    e.reason = payload.reason.trim().slice(0, 200);
    e.resolution = "mutual-end";
    e.status = "cancelled";
    e.messages.push({ by: "partner", text: "已模拟双方同意结束剩余课程。已完成的分享与学习记录保留，未完成课程不计为完成。", demo: true, at: now.toISOString() });
  } else if (action === "cancel") {
    if (!actions.cancel) throw Error("当前状态不能取消，请处理补课事项或查看已有记录。");
    if (!payload.reason?.trim()) throw Error("请填写取消原因。");
    e.status = e.lessons.some((l) => l.done) ? "rescheduling" : "cancelled";
    e.reason = payload.reason.trim().slice(0, 200);
  } else if (action === "completeLesson") {
    if (!["scheduled", "learning"].includes(e.status))
      throw Error("请先确认交换安排。");
    const lesson = e.lessons[payload.index];
    if (!lesson || lesson.done) throw Error("这节课程已经完成或不存在。");
    if (!actions.completeLesson[payload.index]) throw Error("请先完成前一节课程。");
    const goalStatus = payload.goalStatus || "achieved";
    if (!["achieved", "needs-help"].includes(goalStatus)) throw Error("请选择目标完成情况。");
    if (goalStatus === "needs-help" && !payload.reflection?.trim()) throw Error("请写下还需要帮助的内容。");
    const artifact = artifactUrl(payload.artifact || "");
    lesson.goalStatus = goalStatus;
    lesson.artifact = artifact;
    lesson.done = true;
    lesson.reflection = (payload.reflection || "").slice(0, 200);
    lesson.completedAt = now.toISOString();
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
    const tags = payload.tags || [];
    if (!Array.isArray(tags) || tags.some((tag) => !["讲解清楚", "耐心友好", "目标达成"].includes(tag)))
      throw Error("请选择有效的评价标签。");
    if (tags.includes("目标达成") && e.lessons.some((lesson) => lesson.goalStatus === "needs-help"))
      throw Error("仍有目标需要帮助，不能标记目标全部达成。");
    e.review = {
      rating: payload.rating,
      text: payload.text.trim().slice(0, 300),
      tags: [...new Set(tags)],
      at: now.toISOString(),
    };
    e.status = "completed";
  } else throw Error("不支持的操作。");
  return e;
}
