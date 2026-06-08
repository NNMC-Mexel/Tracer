/**
 * Импорт сотрудников из xlsx в Strapi (программный API).
 *
 * Запуск:
 *   node scripts/seed-employees.cjs           — импорт (пропустит, если данные уже есть)
 *   node scripts/seed-employees.cjs --reset    — очистить и импортировать заново
 *
 * Должности и подразделения берутся «как есть» из файлов.
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));

const XLSX = require("xlsx");
const { createStrapi, compileStrapi } = require("@strapi/strapi");

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

async function main() {
  const reset = process.argv.includes("--reset");
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";

  const db = (uid) => app.db.query(uid);
  const ORG = "api::organization.organization";
  const DEP = "api::department.department";
  const EMP = "api::employee.employee";

  try {
    const existing = await db(EMP).count();
    if (existing > 0 && !reset) {
      console.log(`[seed] В базе уже ${existing} сотрудников. Запустите с --reset для пересоздания. Выходим.`);
      return;
    }
    if (reset) {
      console.log("[seed] --reset: очищаю employees / departments / organizations…");
      await db(EMP).deleteMany({ where: {} });
      await db(DEP).deleteMany({ where: {} });
      await db(ORG).deleteMany({ where: {} });
    }

    // Сбор и дедупликация
    let all = [];
    for (const f of FILES) all = all.concat(loadRows(f));
    const seen = new Set();
    all = all.filter((r) => {
      const k = `${r.code}__${r.fullName}__${r.position}__${r.department}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    console.log(`[seed] Уникальных сотрудников к импорту: ${all.length}`);

    // Организации
    const orgId = {};
    for (const f of FILES) {
      const rec = await db(ORG).create({ data: { name: f.org, code: f.code } });
      orgId[f.code] = rec.id;
      console.log(`[seed] Организация: ${f.org} (id=${rec.id})`);
    }

    // Подразделения (уникальные по org+name)
    const depKey = (code, name) => `${code}__${name}`;
    const depId = {};
    const depSet = new Map();
    for (const r of all) {
      const k = depKey(r.code, r.department);
      if (!depSet.has(k)) depSet.set(k, { code: r.code, name: r.department });
    }
    for (const { code, name } of depSet.values()) {
      const rec = await db(DEP).create({
        data: { name: name || "(без подразделения)", organization: orgId[code] },
      });
      depId[depKey(code, name)] = rec.id;
    }
    console.log(`[seed] Подразделений создано: ${depSet.size}`);

    // Сотрудники
    let n = 0;
    for (const r of all) {
      await db(EMP).create({
        data: {
          fullName: r.fullName,
          position: r.position,
          organization: orgId[r.code],
          department: depId[depKey(r.code, r.department)],
          active: true,
        },
      });
      n++;
      if (n % 200 === 0) console.log(`[seed] …${n}/${all.length}`);
    }
    console.log(`[seed] Готово. Сотрудников: ${n}, подразделений: ${depSet.size}, организаций: ${FILES.length}`);
  } finally {
    await app.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[seed] ОШИБКА:", e);
    process.exit(1);
  });
