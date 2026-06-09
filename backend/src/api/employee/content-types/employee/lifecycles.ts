/**
 * Автоматическое определение категории персонала (ВМР/СМР/ММП/ДР) по должности.
 * Срабатывает при создании сотрудника (в т.ч. через «Новый сотрудник» на фронте)
 * и при смене должности, если категория не задана явно.
 *
 * Правила:
 *  ВМР — врачи, ординаторы, резиденты;
 *  СМР — медсёстры, фельдшеры, лаборанты, анестезисты и пр. средний медперсонал;
 *  ММП — санитарки, уборщицы, буфетчицы, сёстры-хозяйки и пр. младший персонал;
 *  ДР  — всё остальное (бухгалтеры, юристы, инженеры, хоз. служба, АУП и т.д.).
 */
function classify(position?: string): string {
  const p = (position || "").toLowerCase();
  if (/санитар|уборщиц|буфетчиц|сестра-хозяйк|машинист по стирке|швея|прачеч/.test(p)) return "ММП";
  if (/врач|ординатор|резидент/.test(p)) return "ВМР";
  if (/медсестр|медбрат|фельдшер|лаборант|анестезист|акушер|массажист|инструктор лфк|перфузиолог|рентген.*сестр|сестра/.test(p))
    return "СМР";
  return "ДР";
}

type LifecycleEvent = { params: { data?: { position?: string; category?: string } } };

export default {
  beforeCreate(event: LifecycleEvent) {
    const d = event.params.data;
    if (d && !d.category) d.category = classify(d.position);
  },
  beforeUpdate(event: LifecycleEvent) {
    const d = event.params.data;
    if (d && d.position !== undefined && !d.category) d.category = classify(d.position);
  },
};
