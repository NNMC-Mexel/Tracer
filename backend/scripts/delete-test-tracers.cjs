/** Удаляет все сессии трейсеров и их субъекты (тестовые данные). */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  try {
    const subs = await app.db.query("api::tracer-subject.tracer-subject").deleteMany({ where: {} });
    const sess = await app.db.query("api::tracer-session.tracer-session").deleteMany({ where: {} });
    console.log(`[clean] удалено субъектов: ${subs?.count ?? "?"}, сессий: ${sess?.count ?? "?"}`);
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
