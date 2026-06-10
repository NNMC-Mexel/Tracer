/**
 * Расширение Users & Permissions: дополняем /api/users/me направлением (program),
 * иначе стандартный контроллер me его не возвращает, и фильтрация по направлению не работает.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default (plugin: any) => {
  const baseMe = plugin.controllers.user.me;

  plugin.controllers.user.me = async (ctx: any) => {
    await baseMe(ctx);
    const userId = ctx.body?.id;
    if (!userId) return;
    const strapiAny = (globalThis as any).strapi;
    const full = await strapiAny.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId }, populate: { program: true } });
    if (full?.program) {
      ctx.body = {
        ...ctx.body,
        program: { id: full.program.id, name: full.program.name, slug: full.program.slug },
      };
    }
  };

  return plugin;
};
