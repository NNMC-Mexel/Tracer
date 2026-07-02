import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // Разрешаем обращения к API с любого источника (фронт ходит по Bearer-токену,
      // не по cookie, поэтому '*' безопасно). ВАЖНО: строка '*', а НЕ ['*'] —
      // внутри массива Strapi трактует '*' как буквальный origin и отклоняет всё
      // остальное с 403. При желании можно сузить до конкретных доменов фронта.
      origin: '*',
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
