/**
 * Включает вариант «Не требуется» (allowNa) СРАЗУ ДЛЯ ВСЕХ вопросов опросника —
 * флаг ставится на уровне опросника (форма читает questionnaire.allowNa || criterion.allowNa).
 * Критерии и проведённые трейсеры не трогаются.
 *
 *   node scripts/set-questionnaire-na.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

/** Опросники, где «Не требуется» доступно во всех вопросах. */
const ENABLE_SLUGS = ["infection-control-sp"];

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const Q = "api::questionnaire.questionnaire";
  try {
    for (const slug of ENABLE_SLUGS) {
      const q = await app.db.query(Q).findOne({ where: { slug } });
      if (!q) {
        console.log(`[na-q] НЕ НАЙДЕН: ${slug}`);
        continue;
      }
      if (q.allowNa) {
        console.log(`[na-q] уже включено: ${slug} («${q.name}»)`);
        continue;
      }
      await app.db.query(Q).update({ where: { id: q.id }, data: { allowNa: true } });
      console.log(`[na-q] ВКЛЮЧЕНО «Не требуется» для всех вопросов: ${slug} («${q.name}»)`);
    }
  } finally {
    await app.destroy();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("[na-q] ОШИБКА:", e); process.exit(1); });
