/**
 * Точечно правит формулировки критериев в трейсере «Инфекционный контроль в СП».
 * Сопоставление по № критерия (order). Старые снимки (criteriaSnapshot) не трогаются.
 *   node scripts/update-ic-criteria.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const UPDATES = {
  5: "Маркировка ёмкостей из-под дез. растворов (мерная посуда, отметки по литрам)",
  10: "Маркировка уборочного инвентаря",
  11: "Маркировка ветошей",
  13: "Санитарное состояние рециркулятора, бактерицидных ламп",
  14: "Маркировка мешков (чистое/грязное бельё, чистые/грязные инструменты)",
};

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const Q = "api::questionnaire.questionnaire";
  const C = "api::criterion.criterion";
  try {
    const q = await app.db.query(Q).findOne({ where: { slug: "infection-control-sp" }, populate: { criteria: true } });
    if (!q) {
      console.log("[ic] опросник infection-control-sp не найден");
      return;
    }
    let n = 0;
    for (const c of q.criteria) {
      const nt = UPDATES[c.order];
      if (nt && nt !== c.text) {
        console.log(`[ic] №${c.order}: «${c.text}» → «${nt}»`);
        await app.db.query(C).update({ where: { id: c.id }, data: { text: nt } });
        n++;
      }
    }
    console.log(`[ic] обновлено критериев: ${n}`);
  } finally {
    await app.destroy();
  }
})().then(() => process.exit(0)).catch((e) => { console.error("[ic] ОШИБКА:", e); process.exit(1); });
