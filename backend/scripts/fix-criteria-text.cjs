/**
 * Точечная замена текста критериев (без пересоздания опросников — ID критериев сохраняются).
 * Список пар [старый текст, новый текст]; совпадение по точному тексту.
 *
 *   node scripts/fix-criteria-text.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const REPLACEMENTS = [
  ["Правильное расположение документов МКСБ", "Правильное расположение документов МКСП"],
];

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const C = "api::criterion.criterion";
  try {
    let total = 0;
    for (const [oldText, newText] of REPLACEMENTS) {
      const rows = await app.db.query(C).findMany({ where: { text: oldText } });
      for (const r of rows) {
        await app.db.query(C).update({ where: { id: r.id }, data: { text: newText } });
        console.log(`[fix] id=${r.id}: «${oldText}» → «${newText}»`);
        total++;
      }
      if (!rows.length) console.log(`[fix] не найдено: «${oldText}»`);
    }
    console.log(`[fix] обновлено критериев: ${total}`);
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[fix] ОШИБКА:", e); process.exit(1); });
