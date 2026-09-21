import test from "node:test";
import assert from "node:assert/strict";
import { initialState, PEOPLE } from "../data/seed.mjs";
import {
  match,
  matches,
  validatePost,
  createExchange,
  transition,
  upcoming,
  overlaps,
  loadState,
  saveState,
} from "../src/model.mjs";
const now = new Date("2026-09-19T08:00:00Z"),
  partner = PEOPLE.find((p) => p.id === "lin");
const input = () => ({
  teach: "摄影",
  learn: "Python",
  format: "视频交流",
  note: "一起学习",
  times: ["2026-09-20T12:00:00Z", "2026-09-23T12:00:00Z"],
});
const scenario = () => {
  const s = initialState();
  return { s, e: createExchange(s, partner, input(), now) };
};
test("reciprocal match requires both directions, compatible format and active post", () => {
  const me = initialState().me;
  assert.equal(match(me, partner).eligible, true);
  assert.equal(
    match(
      me,
      PEOPLE.find((p) => p.id === "chen"),
    ).eligible,
    false,
  );
  assert.equal(match({ ...me, active: false }, partner).eligible, false);
  assert.equal(match(me, { ...partner, formats: [] }).eligible, false);
});
test("matching ranks shared availability before negotiation and changes with demand", () => {
  const me = initialState().me;
  assert.deepEqual(
    matches(me, PEOPLE).map((x) => x.person.id),
    ["lin", "tang"],
  );
  me.want = ["网页设计"];
  assert.deepEqual(
    matches(me, PEOPLE).map((x) => x.person.id),
    ["song"],
  );
});
test("post validates skill count, skill identity, text, format and slots", () => {
  const p = initialState().me;
  assert.doesNotThrow(() => validatePost(p));
  for (const patch of [
    { teach: [] },
    { want: ["Python", "摄影", "Excel", "吉他"] },
    { teach: ["fake"] },
    { goal: " " },
    { slots: [] },
    { formats: [] },
  ])
    assert.throws(() => validatePost({ ...p, ...patch }));
});
test("upcoming uses Beijing weekdays, never returns past dates and survives UTC boundary", () => {
  assert.equal(upcoming(["0-20:00"], now)[0], "2026-09-20T12:00:00.000Z");
  assert.equal(
    upcoming(["6-10:00"], new Date("2026-09-18T17:00:00Z"))[0],
    "2026-09-19T02:00:00.000Z",
  );
  assert.ok(upcoming(["6-10:00"], now).every((t) => new Date(t) > now));
});
test("invitation snapshots outcomes and stores two independent lessons", () => {
  const { s, e } = scenario();
  s.me.goal = "changed";
  assert.notEqual(e.lessons[0].goal, "changed");
  assert.equal(e.lessons.length, 2);
  assert.equal(e.status, "pending");
  assert.equal(s.exchanges.length, 1);
});
test("invalid, past, beyond-window, overlap and duplicate invitations rejected", () => {
  for (const times of [
    ["bad", "bad"],
    ["2026-09-18T12:00:00Z", "2026-09-20T12:00:00Z"],
    ["2026-10-20T12:00:00Z", "2026-10-21T12:00:00Z"],
    ["2026-09-20T12:00:00Z", "2026-09-20T12:30:00Z"],
  ])
    assert.throws(() =>
      createExchange(initialState(), partner, { ...input(), times }, now),
    );
  const { s } = scenario();
  assert.throws(() => createExchange(s, partner, input(), now), /已有/);
  assert.equal(overlaps("2026-09-20T12:00:00Z", "2026-09-20T12:45:00Z"), false);
});
test("conflicting reservations with another partner are rejected", () => {
  const { s } = scenario();
  assert.throws(
    () => createExchange(s, { ...partner, id: "other" }, input(), now),
    /其他交换/,
  );
});
test("exchange enforces accept, two lessons, then one review", () => {
  const { e } = scenario();
  assert.throws(() => transition(e, "completeLesson", { index: 0 }));
  transition(e, "accept", {}, now);
  assert.equal(e.status, "scheduled");
  transition(e, "completeLesson", { index: 0 });
  assert.equal(e.status, "learning");
  assert.throws(() => transition(e, "completeLesson", { index: 0 }));
  assert.throws(() => transition(e, "review", { rating: 5, text: "good" }));
  transition(e, "completeLesson", { index: 1 });
  assert.equal(e.status, "review");
  assert.throws(() => transition(e, "review", { rating: 6, text: "good" }));
  transition(e, "review", {
    rating: 5,
    text: "学会了数据清洗",
    tags: ["目标达成"],
  });
  assert.equal(e.status, "completed");
  assert.throws(() => transition(e, "review", { rating: 5, text: "again" }));
  assert.throws(() => transition(e, "cancel", { reason: "later" }));
});
test("pausing a partial exchange preserves completed work and needs a reason", () => {
  const { e } = scenario();
  transition(e, "accept", {}, now);
  transition(e, "completeLesson", { index: 0, reflection: "构图练习" });
  assert.throws(() => transition(e, "cancel", { reason: " " }));
  transition(e, "cancel", { reason: "时间变化" });
  assert.equal(e.lessons[0].done, true);
  assert.equal(e.lessons[0].reflection, "构图练习");
  assert.equal(e.status, "rescheduling");
  assert.throws(() => transition(e, "completeLesson", { index: 1 }));
});
test("decline is terminal and frees a new invitation", () => {
  const { s, e } = scenario();
  transition(e, "decline");
  assert.equal(e.status, "declined");
  assert.throws(() => transition(e, "accept", {}, now));
  assert.doesNotThrow(() => createExchange(s, partner, input(), now));
});
test("paused or incompatible skills cannot invite", () => {
  const s = initialState();
  s.me.active = false;
  assert.throws(() => createExchange(s, partner, input(), now));
  assert.throws(() =>
    createExchange(
      initialState(),
      partner,
      { ...input(), teach: "Excel" },
      now,
    ),
  );
});
test("storage round trip, invalid JSON recovery and unavailable storage feedback", () => {
  let raw;
  const storage = { getItem: () => raw, setItem: (k, v) => (raw = v) };
  const s = initialState();
  s.favorites = ["lin"];
  assert.equal(saveState(storage, s), true);
  assert.deepEqual(loadState(storage).state, s);
  raw = "broken";
  assert.ok(loadState(storage).warning);
  assert.equal(
    saveState(
      {
        setItem() {
          throw Error();
        },
      },
      s,
    ),
    false,
  );
});

test("corrupt exchange records recover instead of rendering an invalid date", () => {
  const s = initialState();
  s.exchanges = [{ id: "broken" }];
  assert.ok(loadState({ getItem: () => JSON.stringify(s) }).warning);
});
