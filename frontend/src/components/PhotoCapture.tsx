"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Alert, Image } from "antd";
import { CameraOutlined, RedoOutlined } from "@ant-design/icons";

interface Props {
  /** Только что снятый файл (или null). */
  file: File | null;
  onChange: (f: File | null) => void;
  /** URL уже сохранённого фото (режим редактирования). */
  existingUrl?: string;
}

/**
 * Снимок проверки на месте через НАТИВНУЮ камеру планшета (input capture).
 * Работает по HTTP (в отличие от getUserMedia). Без выбора из галереи на большинстве планшетов.
 */
export default function PhotoCapture({ file, onChange, existingUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? existingUrl ?? null;

  return (
    <div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Сфотографируйте опрашиваемых на фоне отделения"
        description={
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>В кадре: сотрудник(и), которых проверяете, и обстановка отдела (табличка / пост / журнал).</li>
            <li>Снимок делается камерой сейчас. <b>Без пациентов в кадре.</b></li>
          </ul>
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {shown ? (
        <div>
          <Image
            src={shown}
            alt="Фото проверки"
            style={{ maxHeight: 260, width: "auto", borderRadius: 8 }}
          />
          <div style={{ marginTop: 8 }}>
            <Button icon={<RedoOutlined />} onClick={() => inputRef.current?.click()}>
              Переснять
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="primary"
          size="large"
          icon={<CameraOutlined />}
          onClick={() => inputRef.current?.click()}
          block
          style={{ maxWidth: 360 }}
        >
          Сделать фото
        </Button>
      )}
    </div>
  );
}
