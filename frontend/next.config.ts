import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // В монорепо два package-lock.json (корень и frontend); явно фиксируем
  // корень Turbopack на каталоге фронтенда, чтобы Next не угадывал его неверно.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
