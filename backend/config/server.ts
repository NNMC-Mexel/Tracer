import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  // Публичный адрес за обратным прокси (Coolify/Traefik). Подставляем только
  // валидный http(s)-URL — иначе (пусто/плейсхолдер) Strapi падает на сборке.
  const rawUrl = env('URL', '');
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : undefined;

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    ...(url ? { url } : {}),
    app: {
      keys: env.array('APP_KEYS'),
    },
  };
};

export default config;
