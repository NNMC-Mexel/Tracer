/**
 * Включает вариант «Не требуется» (allowNa=true) на критериях по шаблону текста.
 * По умолчанию — критерий «Обработка рук при входе в отделение и выходе из него»
 * (в любых опросниках, где он есть). Не влияет на шкалу и на другие критерии.
 *   node scripts/set-na-criteria.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

// шаблоны текста критериев, которым нужен вариант «Не требуется»
const PATTERNS = ["входе в отдел"];

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const C = "api::criterion.criterion";
  try {
    let total = 0;
    for (const p of PATTERNS) {
      const crits = await app.db.query(C).findMany({ where: { text: { $containsi: p } } });
      for (const c of crits) {
        if (!c.allowNa) {
          await app.db.query(C).update({ where: { id: c.id }, data: { allowNa: true } });
          console.log(`[na] id=${c.id} ← «${c.text.slice(0, 50)}»`);
          total++;
        }
      }
    }
    console.log(`[na] обновлено критериев: ${total}`);
  } finally {
    await app.destroy();
  }
})().then(() => process.exit(0)).catch((e) => { console.error("[na] ОШИБКА:", e); process.exit(1); });
