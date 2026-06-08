"use client";

import { ConfigProvider, App as AntApp } from "antd";
import ruRU from "antd/locale/ru_RU";
import type { ReactNode } from "react";

/**
 * Клиентские провайдеры Ant Design: русская локаль, общая тема,
 * обёртка App для статических message/notification/modal.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 8,
          fontFamily: "var(--font-app), system-ui, sans-serif",
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
