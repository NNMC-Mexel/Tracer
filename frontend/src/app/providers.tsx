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
          colorPrimary: "#087f8c",
          colorInfo: "#087f8c",
          colorSuccess: "#52c41a",
          colorWarning: "#faad14",
          colorError: "#ff4d4f",
          colorText: "#162a3a",
          colorTextSecondary: "#667985",
          colorBorderSecondary: "#e1e8eb",
          colorBgLayout: "#f3f6f7",
          borderRadius: 10,
          fontFamily: "var(--font-app), system-ui, sans-serif",
        },
        components: {
          Card: { boxShadowTertiary: "none" },
          Table: { headerBg: "#f7f9fa", headerColor: "#536873", rowHoverBg: "#f0f8f8" },
          Menu: { itemSelectedBg: "#e8f5f6", itemSelectedColor: "#087f8c", itemBorderRadius: 10 },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
