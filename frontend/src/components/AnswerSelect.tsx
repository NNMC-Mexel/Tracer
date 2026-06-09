"use client";

import { Button, Space } from "antd";
import { CheckOutlined, MinusOutlined, CloseOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { AnswerValue } from "@/lib/tracers";

const OPTS: { v: AnswerValue; label: string; icon: ReactNode; color: string }[] = [
  { v: "full", label: "Соответствует", icon: <CheckOutlined />, color: "#52c41a" },
  { v: "partial", label: "Частично", icon: <MinusOutlined />, color: "#faad14" },
  { v: "none", label: "Не соответствует", icon: <CloseOutlined />, color: "#ff4d4f" },
];

interface Props {
  /** Текущая оценка. undefined — ничего не выбрано (по умолчанию). */
  value?: AnswerValue;
  onChange: (v: AnswerValue) => void;
  /** Компактный режим — только иконки (для ячеек таблицы). */
  compact?: boolean;
}

/**
 * Цветной выбор оценки: зелёный / жёлтый / красный.
 * По умолчанию ничего не выбрано — кнопка загорается только после нажатия.
 * Без всплывающих подсказок (на планшете они мешали — требовался двойной тап).
 */
export default function AnswerSelect({ value, onChange, compact }: Props) {
  return (
    <Space.Compact>
      {OPTS.map((o) => {
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
