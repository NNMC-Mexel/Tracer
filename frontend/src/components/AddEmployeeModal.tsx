"use client";

import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, App } from "antd";
import {
  createEmployee,
  listDepartments,
  listOrganizations,
  type Department,
  type Employee,
  type Organization,
} from "@/lib/employees";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Вызывается после успешного создания (например, чтобы сразу выбрать сотрудника). */
  onCreated?: (employee: Employee) => void;
  /** Предзаполнить ФИО (например, из строки поиска). */
  initialFullName?: string;
  /** Если задан — нового сотрудника привязываем к этому отделу (и его организации), поля скрываем. */
  fixedDepartmentId?: number;
}

/** Модальное окно добавления нового сотрудника. Используется и в справочнике, и в выборе сотрудника при трейсере. */
export default function AddEmployeeModal({
  open,
  onClose,
  onCreated,
  initialFullName,
  fixedDepartmentId,
}: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const fixedDept = departments.find((d) => d.id === fixedDepartmentId);

  useEffect(() => {
    if (!open) return;
    listOrganizations().then(setOrgs).catch(() => {});
    listDepartments().then(setDepartments).catch(() => {});
    form.setFieldsValue({ fullName: initialFullName ?? "" });
  }, [open, initialFullName, form]);

  async function onOk() {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const created = await createEmployee({
        fullName: values.fullName.trim(),
        position: values.position?.trim(),
        departmentId: fixedDepartmentId ?? values.departmentId,
        organizationId: fixedDepartmentId
          ? fixedDept?.organization?.id
          : values.organizationId,
      });
      message.success("Сотрудник добавлен");
      form.resetFields();
      onCreated?.(created);
      onClose();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error("Не удалось добавить сотрудника");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Новый сотрудник"
      open={open}
      onOk={onOk}
      confirmLoading={loading}
      onCancel={onClose}
      okText="Добавить"
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="fullName"
          label="ФИО"
          rules={[{ required: true, message: "Введите ФИО" }]}
        >
          <Input placeholder="Иванов Иван Иванович" />
        </Form.Item>
        <Form.Item name="position" label="Должность">
          <Input placeholder="Например: медсестра палатная" />
        </Form.Item>

        {fixedDepartmentId ? (
          // Отдел уже выбран в трейсере — привязываем к нему автоматически
          <Form.Item label="Отдел">
            <Input
              disabled
              value={
                fixedDept
                  ? `${fixedDept.name}${
                      fixedDept.organization ? ` · ${fixedDept.organization.name}` : ""
                    }`
                  : "…"
              }
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="organizationId"
              label="Организация"
              rules={[{ required: true, message: "Выберите организацию" }]}
            >
              <Select
                placeholder="Организация"
                options={orgs.map((o) => ({ value: o.id, label: o.name }))}
                onChange={() => form.setFieldValue("departmentId", undefined)}
              />
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(p, c) => p.organizationId !== c.organizationId}
            >
              {({ getFieldValue }) => {
                const selectedOrg = getFieldValue("organizationId");
                const opts = departments
                  .filter((d) => !selectedOrg || d.organization?.id === selectedOrg)
                  .map((d) => ({ value: d.id, label: d.name }));
                return (
                  <Form.Item
                    name="departmentId"
                    label="Отдел"
                    rules={[{ required: true, message: "Выберите отдел" }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Отдел"
                      options={opts}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
