/**
 * Импорт организаций, подразделений и сотрудников из scripts/employees.json в Strapi.
 *   node scripts/seed-employees.cjs           — импорт (пропустит, если данные уже есть)
 *   node scripts/seed-employees.cjs --reset    — очистить и импортировать заново
 *
 * Работает и локально, и внутри контейнера (читает JSON, без зависимости от Excel).
 */
const path = require("path");
const fs = require("fs");
process.chdir(path.join(__dirname, ".."));

const { createStrapi, compileStrapi } = require("@strapi/strapi");

async function main() {
  const reset = process.argv.includes("--reset");
  const dataPath = path.join(__dirname, "employees.json");
  if (!fs.existsSync(dataPath)) {
    console.error(`[seed] Не найден ${dataPath}. Сгенерируйте его: node scripts/gen-employees-json.cjs`);
    process.exit(1);
  }
  const { orgs: orgList, employees: all } = JSON.parse(fs.readFileSync(dataPath, "utf8"));

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

    console.log(`[seed] Сотрудников к импорту: ${all.length}`);

    // Организации
    const orgId = {};
    for (const o of orgList) {
      const rec = await db(ORG).create({ data: { name: o.org, code: o.code } });
      orgId[o.code] = rec.id;
      console.log(`[seed] Организация: ${o.org} (id=${rec.id})`);
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
    console.log(`[seed] Готово. Сотрудников: ${n}, подразделений: ${depSet.size}, организаций: ${orgList.length}`);
  } finally {
    await app.destroy();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("[seed] ОШИБКА:", e); process.exit(1); });
