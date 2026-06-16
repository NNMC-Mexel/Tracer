/**
 * Включает «обратный критерий» (invert=true) по шаблону текста.
 * Сейчас: «Имелись ли проблемы с оборудованием, требующие устранения?» (IPSG-04 тайм-аут) —
 *   «Нет» = соответствует (100%), «Да» = не соответствует (0%).
 *   node scripts/set-invert-criteria.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const PATTERNS = ["проблемы с оборудованием"];

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const C = "api::criterion.criterion";
  try {
    let total = 0;
    for (const p of PATTERNS) {
      const crits = await app.db.query(C).findMany({ where: { text: { $containsi: p } } });
      for (const c of crits) {
        if (!c.invert) {
          await app.db.query(C).update({ where: { id: c.id }, data: { invert: true } });
          console.log(`[inv] id=${c.id} ← «${c.text.slice(0, 50)}»`);
          total++;
        }
      }
    }
    console.log(`[inv] обновлено критериев: ${total}`);
  } finally {
    await app.destroy();
  }
})().then(() => process.exit(0)).catch((e) => { console.error("[inv] ОШИБКА:", e); process.exit(1); });
