"use client";

import { Button, Space, Tooltip } from "antd";
import { CheckOutlined, MinusOutlined, CloseOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { AnswerValue } from "@/lib/tracers";

const OPTS: { v: AnswerValue; label: string; icon: ReactNode; color: string }[] = [
  { v: "full", label: "Соответствует", icon: <CheckOutlined />, color: "#52c41a" },
  { v: "partial", label: "Частично", icon: <MinusOutlined />, color: "#faad14" },
  { v: "none", label: "Не соответствует", icon: <CloseOutlined />, color: "#ff4d4f" },
];

interface Props {
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  /** Компактный режим — только иконки (для ячеек таблицы). */
  compact?: boolean;
}

/** Цветной выбор оценки: зелёный / жёлтый / красный. */
export default function AnswerSelect({ value, onChange, compact }: Props) {
  return (
    <Space.Compact>
      {OPTS.map((o) => {
        const selected = value === o.v;
        return (
          <Tooltip key={o.v} title={compact ? o.label : undefined}>
            <Button
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
          </Tooltip>
        );
      })}
    </Space.Compact>
  );
}
