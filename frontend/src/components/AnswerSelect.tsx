"use client";

import { Button, Space } from "antd";
import { CheckOutlined, MinusOutlined, CloseOutlined, StopOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { AnswerValue, Scale } from "@/lib/tracers";

interface Opt {
  v: AnswerValue;
  label: string;
  icon: ReactNode;
  color: string;
}

function buildOpts(scale: Scale, allowNa?: boolean, invert?: boolean): Opt[] {
  const opts: Opt[] =
    scale === "binary"
      ? [
          { v: "full", label: "Да", icon: <CheckOutlined />, color: "#52c41a" },
          { v: "none", label: "Нет", icon: <CloseOutlined />, color: "#ff4d4f" },
        ]
      : [
          { v: "full", label: "Соответствует", icon: <CheckOutlined />, color: "#52c41a" },
          { v: "partial", label: "Частично", icon: <MinusOutlined />, color: "#faad14" },
          { v: "none", label: "Не соответствует", icon: <CloseOutlined />, color: "#ff4d4f" },
        ];
  // обратный критерий: «Нет» — хорошо (зелёный ✓), «Да» — плохо (красный ✗)
  if (invert) {
    const f = opts.find((o) => o.v === "full");
    const n = opts.find((o) => o.v === "none");
    if (f && n) {
      const tIcon = f.icon, tColor = f.color;
      f.icon = n.icon;
      f.color = n.color;
      n.icon = tIcon;
      n.color = tColor;
    }
  }
  if (allowNa) opts.push({ v: "na", label: "Не требуется", icon: <StopOutlined />, color: "#8c8c8c" });
  return opts;
}

interface Props {
  /** Текущая оценка. undefined — ничего не выбрано (по умолчанию). */
  value?: AnswerValue;
  onChange: (v: AnswerValue) => void;
  /** Компактный режим — только иконки (для ячеек таблицы). */
  compact?: boolean;
  /** Шкала: 3 уровня или Да/Нет. */
  scale?: Scale;
  /** Добавить кнопку «Неприменим» (исключается из расчёта). */
  allowNa?: boolean;
  /** Обратный критерий: «Нет» = хорошо. */
  invert?: boolean;
}

/**
 * Цветной выбор оценки.
 * 3 уровня: Соответствует / Частично / Не соответствует.
 * Да/Нет: Да / Нет.
 * По умолчанию ничего не выбрано — кнопка загорается только после нажатия.
 * Без всплывающих подсказок (на планшете они требовали двойной тап).
 */
export default function AnswerSelect({
  value,
  onChange,
  compact,
  scale = "three_level",
  allowNa,
  invert,
}: Props) {
  const opts = buildOpts(scale, allowNa, invert);
  return (
    <Space.Compact>
      {opts.map((o) => {
        const selected = value === o.v;
        return (
          <Button
            key={o.v}
            size={compact ? "small" : "middle"}
            onClick={() => onChange(o.v)}
            icon={o.icon}
            style={
              selected
                ? { background: o.color, borderColor: o.color, color: "#fff", fontWeight: 600 }
                : { color: o.color }
            }
          >
            {compact ? null : o.label}
          </Button>
        );
      })}
    </Space.Compact>
  );
}
