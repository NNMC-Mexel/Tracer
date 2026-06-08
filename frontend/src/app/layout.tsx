import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-app",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Трейсер чистоты — мониторинг гигиены рук",
  description:
    "Цифровая система проведения трейсеров по соблюдению гигиены рук",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
