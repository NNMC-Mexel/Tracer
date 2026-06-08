/**
 * Разовый генератор: Excel (сотрудники) -> backend/scripts/employees.json.
 * Запускать ЛОКАЛЬНО (нужен корневой dev-dep xlsx и сами файлы).
 *   node scripts/gen-employees-json.cjs
 */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const SRC_DIR = "E:\\трейсер чистоты\\сотрудники";
const FILES = [
  { file: "ННМЦ на 05.06.2026.xlsx", org: "АО Национальный научный медицинский центр", code: "ННМЦ" },
  { file: "Mexel на 05.06.2026.xlsx", org: "Mexel", code: "Mexel" },
];

function loadRows({ file, org, code }) {
  const wb = XLSX.readFile(path.join(SRC_DIR, file));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  let h = -1;
  for (let i = 0; i < rows.length; i++) {
    const j = rows[i].map(String).join("|");
    if (j.includes("Сотрудник") && j.includes("Должность")) { h = i; break; }
  }
  const header = rows[h].map((c) => String(c).trim());
  const cN = header.findIndex((c) => c === "Сотрудник");
  const cP = header.findIndex((c) => c === "Должность");
  const cD = header.findIndex((c) => c === "Подразделение");
  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const name = String(rows[i][cN] ?? "").trim();
    if (!name) continue;
    out.push({
      fullName: name,
      position: String(rows[i][cP] ?? "").trim(),
      department: String(rows[i][cD] ?? "").trim(),
      org,
      code,
    });
  }
  return out;
}

let all = [];
for (const f of FILES) all = all.concat(loadRows(f));
const seen = new Set();
all = all.filter((r) => {
  const k = `${r.code}__${r.fullName}__${r.position}__${r.department}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const orgs = FILES.map((f) => ({ org: f.org, code: f.code }));
const outPath = path.join(__dirname, "employees.json");
fs.writeFileSync(outPath, JSON.stringify({ orgs, employees: all }, null, 0), "utf8");
console.log(`Готово: ${all.length} сотрудников -> ${outPath}`);
