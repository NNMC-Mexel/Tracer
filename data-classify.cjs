const XLSX = require("xlsx");
const path = require("path");

const dir = "E:\\трейсер чистоты\\сотрудники";
const files = ["Mexel на 05.06.2026.xlsx", "ННМЦ на 05.06.2026.xlsx"];

function loadFile(f) {
  const wb = XLSX.readFile(path.join(dir, f));
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
      name,
      pos: String(rows[i][cP] ?? "").trim(),
      dep: String(rows[i][cD] ?? "").trim(),
    });
  }
  return out;
}

// Классификатор должности -> категория
function classify(posRaw) {
  const p = posRaw.toLowerCase();
  // Младший медперсонал (санитарки)
  if (/санитар|уборщиц|буфетчиц|сестра-хозяйк|сестра-хозяйка|машинист по стирке|швея|прачеч/.test(p))
    return "Санитарка";
  // Врачи
  if (/врач|ординатор|резидент|перфузиолог|интервенционн.*кардиолог|^интервенционный кардиолог/.test(p))
    return "Врач";
  // Средний медперсонал (медсёстры)
  if (/медсестр|медбрат|мед\.?сестра|сестра|фельдшер|анестезист|рентген-?лаборант|лаборант|инструктор лфк|массажист|акушер|рентгенопера|рентгенанест|перфузиолог.*сестр/.test(p))
    return "Медсестра";
  // Провизоры/фармацевты — отдельно (часто отдельный опросник или к врачам)
  if (/провизор|фармацевт|фармаколог/.test(p)) return "Фармацевт";
  return "Немедицинский";
}

let all = [];
for (const f of files) {
  const recs = loadFile(f).map((r) => ({ ...r, org: f.startsWith("ННМЦ") ? "ННМЦ" : "Mexel" }));
  all = all.concat(recs);
}
// дедуп
const seen = new Set();
all = all.filter((r) => {
  const k = `${r.org}__${r.name}__${r.pos}__${r.dep}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

for (const org of ["ННМЦ", "Mexel"]) {
  const sub = all.filter((r) => r.org === org);
  const byCat = {};
  sub.forEach((r) => {
    const c = classify(r.pos);
    byCat[c] = (byCat[c] || 0) + 1;
  });
  console.log(`\n=== ${org}: ${sub.length} сотрудников ===`);
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${n}\t${c}`));
}

// показать, что попало в "Немедицинский" среди ННМЦ (для проверки границы)
const nonmed = {};
all.filter((r) => r.org === "ННМЦ" && classify(r.pos) === "Немедицинский")
  .forEach((r) => (nonmed[r.pos] = (nonmed[r.pos] || 0) + 1));
console.log(`\n=== ННМЦ: должности в "Немедицинский" (${Object.keys(nonmed).length}) ===`);
Object.entries(nonmed).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${n}\t${p}`));
