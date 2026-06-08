import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  // Публичный адрес за обратным прокси (Coolify/Traefik). Локально не нужен.
  url: env('URL', undefined),
  app: {
    keys: env.array('APP_KEYS'),
  },
});

export default config;
