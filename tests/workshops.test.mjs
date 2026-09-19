import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PEOPLE } from "../data/seed.mjs";
import { WORKSHOPS, workshopText, MERGE_SCRIPT, CLEAN_SCRIPT } from "../data/workshops.mjs";

test("every partner has usable practice materials, reference results and exportable notes", () => {
  assert.deepEqual(Object.keys(WORKSHOPS).sort(), PEOPLE.map((p) => p.id).sort());
  for (const [id, workshop] of Object.entries(WORKSHOPS)) {
    assert.ok(workshop.title && workshop.challenge && workshop.answer, id);
    assert.ok(workshop.blocks.length >= 2, id);
    for (const block of [...workshop.blocks, workshop.expected]) {
      if (block.type === "table") {
        assert.ok(block.rows.length > 0, id);
        assert.ok(block.rows.every((row) => row.length === block.columns.length), id);
      } else assert.ok(block.content.trim(), id);
    }
    const notes = workshopText(workshop);
    assert.ok(notes.includes(workshop.answer));
    assert.ok(notes.includes(workshop.expected.title));
    const names = (workshop.files || []).map((file) => file.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.every((name) => !name.includes("/")));
  }
});

test("downloaded Python examples run and produce the documented results without changing inputs", () => {
  const results = resolve("result");
  mkdirSync(results, { recursive: true });
  const folder = mkdtempSync(join(results, "workshop-check-"));
  for (const file of WORKSHOPS.lin.files) writeFileSync(join(folder, file.name), file.content);
  writeFileSync(join(folder, "clean_names.py"), CLEAN_SCRIPT);
  const checks = `
from pathlib import Path
import runpy, csv, sys
folder = Path(sys.argv[1])
original = {name: (folder / name).read_bytes() for name in ["morning.csv", "afternoon.csv"]}
runpy.run_path(str(folder / "merge_registrations.py"), run_name="__main__")
with (folder / "result/registrations.csv").open(encoding="utf-8-sig", newline="") as source:
    rows = list(csv.DictReader(source))
assert [(r["id"], r["name"], r["skill"]) for r in rows] == [("101", "小麦", "摄影"), ("102", "可可", "Figma"), ("103", "一禾", "Excel"), ("104", "江望", "吉他")]
assert all((folder / name).read_bytes() == value for name, value in original.items())
with (folder / "afternoon.csv").open("a", encoding="utf-8") as target:
    target.write("105,沈眠,日语\\n")
namespace = runpy.run_path(str(folder / "merge_registrations.py"))
assert len(namespace["merge_registrations"](folder)) == 5
with (folder / "afternoon.csv").open("w", encoding="utf-8") as target:
    target.write(original["afternoon.csv"].decode("utf-8") + "102,沈眠,日语\\n")
rows = namespace["merge_registrations"](folder)
assert len(rows) == 4
assert next(row for row in rows if row["id"] == "102")["name"] == "沈眠"
clean = runpy.run_path(str(folder / "clean_names.py"))["clean_names"]
assert clean([" cover.jpg ", "", "notes.txt", "cover.jpg", "  "]) == ["cover.jpg", "notes.txt"]
assert clean(["A.jpg", "a.jpg", " A.jpg "]) == ["A.jpg", "a.jpg"]
assert clean([]) == []
print("Python examples and exercise answers verified")
`;
  const run = spawnSync("/opt/anaconda3/envs/MachineLearning/bin/python", ["-c", checks, folder], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(WORKSHOPS.lin.files.find((file) => file.name.endsWith(".py")).content, MERGE_SCRIPT);
});

test("spreadsheet sample totals and category answers agree with the downloadable data", () => {
  const records = WORKSHOPS.chen.files[0].content.trim().split("\n").slice(1).map((row) => row.split(","));
  const totals = {};
  for (const row of records) totals[row[1]] = (totals[row[1]] || 0) + Number(row[3]);
  assert.deepEqual(totals, { "餐饮": 72, "交通": 8, "学习": 18 });
  assert.equal(Object.values(totals).reduce((a, b) => a + b, 0), 98);
  assert.equal(Object.values(totals).reduce((a, b) => a + b, 24), 122);
});
