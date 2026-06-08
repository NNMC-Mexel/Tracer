import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // Разрешаем обращения к API с любого источника (фронт ходит по Bearer-токену,
      // не по cookie, поэтому '*' безопасно). При желании можно сузить до доменов фронта.
      origin: ['*'],
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
