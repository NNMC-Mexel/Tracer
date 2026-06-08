const XLSX = require("xlsx");
const path = require("path");

const dir = "E:\\трейсер чистоты\\сотрудники";
const files = ["Mexel на 05.06.2026.xlsx", "ННМЦ на 05.06.2026.xlsx"];

const records = [];

for (const f of files) {
  const wb = XLSX.readFile(path.join(dir, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // найти строку-заголовок (содержит "Сотрудник" и "Должность")
  let hIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map((c) => String(c)).join("|");
    if (joined.includes("Сотрудник") && joined.includes("Должность")) {
      hIdx = i;
      break;
    }
  }
  const header = rows[hIdx].map((c) => String(c).trim());
  const cName = header.findIndex((c) => c === "Сотрудник");
  const cPos = header.findIndex((c) => c === "Должность");
  const cDep = header.findIndex((c) => c === "Подразделение");

  let count = 0;
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[cName] ?? "").trim();
    const pos = String(r[cPos] ?? "").trim();
    const dep = String(r[cDep] ?? "").trim();
    if (!name) continue;
    records.push({ file: f, name, pos, dep });
    count++;
  }
  console.log(`${f}: header@${hIdx} cols(name=${cName},pos=${cPos},dep=${cDep}) -> ${count} rows`);
}

// дедупликация по name+pos+dep
const seen = new Set();
const unique = records.filter((r) => {
  const k = `${r.name}__${r.pos}__${r.dep}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`\nВСЕГО строк: ${records.length}, уникальных (ФИО+должн+подр): ${unique.length}`);

// уникальные подразделения
const deps = {};
unique.forEach((r) => (deps[r.dep] = (deps[r.dep] || 0) + 1));
const depList = Object.entries(deps).sort((a, b) => b[1] - a[1]);
console.log(`\n=== ПОДРАЗДЕЛЕНИЯ: ${depList.length} ===`);
depList.forEach(([d, n]) => console.log(`${n}\t${d}`));

// уникальные должности
const poss = {};
unique.forEach((r) => (poss[r.pos] = (poss[r.pos] || 0) + 1));
const posList = Object.entries(poss).sort((a, b) => b[1] - a[1]);
console.log(`\n=== ДОЛЖНОСТИ: ${posList.length} ===`);
posList.forEach(([p, n]) => console.log(`${n}\t${p}`));
