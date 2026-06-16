/**
 * Вариант «Не требуется» (allowNa) — ТОЧЕЧНО:
 *   включает на критериях по шаблону текста ТОЛЬКО в указанных опросниках (по slug),
 *   и СНИМАЕТ его с тех же по тексту критериев в других опросниках (чистка ошибочного).
 *
 * Сейчас: критерий «Обработка рук при входе в отделение…» —
 *   ВКЛ только в эпид «hand-hygiene» (3 значения), ВЫКЛ в остальных (напр. качество ipsg05-hands).
 *   node scripts/set-na-criteria.cjs
 */
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const PATTERN = "входе в отдел";
const ENABLE_SLUGS = ["hand-hygiene"]; // где «Не требуется» нужен

(async () => {
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = "error";
  const C = "api::criterion.criterion";
  try {
    const crits = await app.db
      .query(C)
      .findMany({ where: { text: { $containsi: PATTERN } }, populate: { questionnaire: true } });
    let on = 0;
    let off = 0;
    for (const c of crits) {
      const slug = c.questionnaire?.slug ?? "—";
      const want = ENABLE_SLUGS.includes(slug);
      if (!!c.allowNa !== want) {
        await app.db.query(C).update({ where: { id: c.id }, data: { allowNa: want } });
        if (want) on++; else off++;
        console.log(`[na] ${want ? "ВКЛ" : "ВЫКЛ"} id=${c.id} (опросник ${slug})`);
      }
    }
    console.log(`[na] включено: ${on}, выключено: ${off}`);
  } finally {
    await app.destroy();
  }
})().then(() => process.exit(0)).catch((e) => { console.error("[na] ОШИБКА:", e); process.exit(1); });
