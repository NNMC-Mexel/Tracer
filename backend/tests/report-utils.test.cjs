const test = require("node:test");
const assert = require("node:assert/strict");

const {
  positiveInt,
  validIsoDate,
  monthSpan,
  monthsBetween,
  classifyTrend,
} = require("../dist/src/api/report/controllers/report.js");

test("positiveInt принимает только положительные безопасные целые", () => {
  assert.equal(positiveInt("12"), 12);
  for (const value of [undefined, "", "0", "-1", "1.5", "abc", "9007199254740992"])
    assert.equal(positiveInt(value), null);
});

test("validIsoDate проверяет формат и реальную календарную дату", () => {
  assert.equal(validIsoDate("2024-02-29"), true);
  for (const value of ["2023-02-29", "2026-02-30", "2026-13-01", "01.01.2026", "banana"])
    assert.equal(validIsoDate(value), false);
});

test("monthSpan и monthsBetween корректно проходят границу года", () => {
  assert.equal(monthSpan("2025-12-01", "2026-02-28"), 3);
  assert.deepEqual(monthsBetween("2025-12-01", "2026-02-28"), ["2025-12", "2026-01", "2026-02"]);
});

test("monthsBetween не обрезает валидное окно из 24 месяцев", () => {
  const months = monthsBetween("2025-01-01", "2026-12-31");
  assert.equal(months.length, 24);
  assert.equal(months[0], "2025-01");
  assert.equal(months[23], "2026-12");
});

test("classifyTrend покрывает все состояния", () => {
  assert.equal(classifyTrend([]), "insufficient");
  assert.equal(classifyTrend([50, 55]), "persistent");
  assert.equal(classifyTrend([50, 70]), "improving");
  assert.equal(classifyTrend([90, 70]), "worsening");
  assert.equal(classifyTrend([80, 82]), "stable");
});
