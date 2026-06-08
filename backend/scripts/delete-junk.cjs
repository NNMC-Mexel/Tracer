/** Удаляет тестовые записи сотрудников с '?' в ФИО (артефакт кодировки теста). */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  try {
    const junk = await app.db
      .query("api::employee.employee")
      .findMany({ where: { fullName: { $contains: "?" } } });
    for (const e of junk) {
      await app.db.query("api::employee.employee").delete({ where: { id: e.id } });
      console.log(`[clean] удалён id=${e.id} "${e.fullName}"`);
    }
    console.log(`[clean] удалено записей: ${junk.length}`);
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
