import test from "node:test";
import assert from "node:assert/strict";
import { initialState, PEOPLE, LESSON_CONTENT } from "../data/seed.mjs";
import { createExchange, availableLessonTimes, loadState, upcoming } from "../src/model.mjs";
const now = new Date("2026-09-19T08:00:00Z");
const partner = PEOPLE.find((p) => p.id === "lin");
const input = {
  teach: "摄影", learn: "Python", format: "视频交流", note: "一起学习",
  times: ["2026-09-20T12:00:00Z", "2026-09-23T12:00:00Z"],
};
const read = (state) => loadState({ getItem: () => JSON.stringify(state) });
test("time suggestions avoid pending reservations and use the next available dates", () => {
  const state = initialState();
  createExchange(state, partner, input, now);
  assert.deepEqual(availableLessonTimes(state, partner.slots, now).slice(0, 2), ["2026-09-27T12:00:00.000Z", "2026-09-30T12:00:00.000Z"]);
});
test("cancelled exchanges free suggestions, and an exhausted schedule stays empty", () => {
  const state = initialState();
  const e = createExchange(state, partner, input, now);
  e.lessons = upcoming(partner.slots, now).map((at) => ({ at, done: false }));
  assert.deepEqual(availableLessonTimes(state, partner.slots, now), []);
  e.status = "cancelled";
  assert.equal(availableLessonTimes(state, partner.slots, now).length, 4);
});
test("second lesson must follow the first without mutating exchange records", () => {
  const state = initialState();
  assert.throws(() => createExchange(state, partner, { ...input, times: [...input.times].reverse() }, now), /第二节课/);
  assert.deepEqual(state.exchanges, []);
});
test("incomplete draft and current step survive reload without changing published needs", () => {
  const state = initialState();
  state.draft = { ...structuredClone(state.me), teach: [], goal: "", name: "old name" };
  state.draftStep = 2;
  const restored = read(state);
  assert.equal(restored.warning, undefined);
  assert.deepEqual(restored.state.draft.teach, []);
  assert.equal(restored.state.draft.goal, "");
  assert.equal(restored.state.draftStep, 2);
  assert.equal(restored.state.draft.name, state.me.name);
  assert.deepEqual(restored.state.me.teach, ["摄影"]);
});
test("broken draft is discarded independently while exchanges and favorites survive", () => {
  for (const draft of [{ teach: null }, "invalid", { ...initialState().me, goal: 42 }]) {
    const state = initialState();
    state.favorites = ["lin"];
    createExchange(state, partner, input, now);
    state.draft = draft;
    const restored = read(state);
    assert.match(restored.warning, /草稿/);
    assert.equal(restored.state.draft, null);
    assert.equal(restored.state.exchanges.length, 1);
    assert.deepEqual(restored.state.favorites, ["lin"]);
  }
});
test("all twelve sample lessons have a 45-minute agenda, preparation, outcome and distinct feedback", () => {
  assert.equal(Object.keys(LESSON_CONTENT).length, PEOPLE.length);
  assert.equal(new Set(PEOPLE.map((p) => p.lesson.review)).size, PEOPLE.length);
  for (const person of PEOPLE) {
    const lesson = person.lesson;
    assert.equal(lesson.agenda.reduce((sum, [minutes]) => sum + minutes, 0), 45);
    assert.equal(lesson.agenda.length, 3);
    assert.ok(lesson.prepare.length >= 2);
    for (const field of ["experience", "takeaway", "practice", "review"]) assert.ok(lesson[field].trim(), `${person.id}: missing ${field}`);
  }
});
