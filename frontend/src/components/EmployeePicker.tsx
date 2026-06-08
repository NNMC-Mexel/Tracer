"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select, Button, Space, Empty } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { listEmployees, type Employee } from "@/lib/employees";
import AddEmployeeModal from "./AddEmployeeModal";

interface Props {
  /** Вызывается при выборе сотрудника (из списка или после добавления нового). */
  onSelect: (employee: Employee) => void;
  /** id сотрудников, которых уже выбрали — их прячем из подсказок. */
  excludeIds?: number[];
  /** Если задан — поиск идёт только по этому отделу (коллектив отдела), и новый сотрудник привяжется к нему. */
  departmentId?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Поиск и выбор сотрудника по ФИО с автоподсказками.
 * Если задан departmentId — показывает коллектив этого отдела (без ввода) и ищет внутри него,
 * а «Добавить нового» сразу привязывает сотрудника к этому отделу.
 */
export default function EmployeePicker({
  onSelect,
  excludeIds = [],
  departmentId,
  placeholder = "Поиск сотрудника по ФИО",
  disabled,
}: Props) {
  const [options, setOptions] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      // в режиме отдела показываем весь коллектив без ввода; иначе — от 2 символов
      if (!departmentId && (!q || q.trim().length < 2)) {
        setOptions([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      listEmployees({
        search: q.trim() || undefined,
        departmentId,
        pageSize: departmentId ? 300 : 20,
      })
        .then((res) => setOptions(res.data))
        .catch(() => setOptions([]))
        .finally(() => {
          setLoading(false);
          setSearched(true);
        });
    },
    [departmentId],
  );

  // загрузка коллектива при выборе отдела
  useEffect(() => {
    if (departmentId) runSearch("");
    else {
      setOptions([]);
      setSearched(false);
    }
    setSearch("");
  }, [departmentId, runSearch]);

  // дебаунс поиска
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search, runSearch]);

  const visible = useMemo(
    () => options.filter((e) => !excludeIds.includes(e.id)),
    [options, excludeIds],
  );

  const selectOptions = visible.map((e) => ({
    value: e.id,
    label: (
      <span>
        {e.fullName}
        {e.position ? <span style={{ color: "#888" }}> — {e.position}</span> : null}
        {!departmentId && e.department?.name ? (
          <span style={{ color: "#aaa" }}> · {e.department.name}</span>
        ) : null}
      </span>
    ),
  }));

  function handleChange(id: number) {
    const emp = visible.find((e) => e.id === id);
    if (emp) {
      onSelect(emp);
      setSearch("");
      if (departmentId) runSearch("");
      else {
        setOptions([]);
        setSearched(false);
      }
    }
  }

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Select
          showSearch
          value={null}
          disabled={disabled}
          style={{ width: "100%" }}
          placeholder={placeholder}
          filterOption={false}
          onSearch={setSearch}
          searchValue={search}
          onChange={handleChange}
          loading={loading}
          options={selectOptions}
          notFoundContent={
            searched && !loading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Сотрудник не найден"
              >
                <Button
                  type="link"
                  icon={<UserAddOutlined />}
                  onClick={() => setAddOpen(true)}
                >
                  Добавить нового
                </Button>
              </Empty>
            ) : null
          }
        />
        <Button
          icon={<UserAddOutlined />}
          disabled={disabled}
          onClick={() => setAddOpen(true)}
        >
          Новый
        </Button>
      </Space.Compact>

      <AddEmployeeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initialFullName={search}
        fixedDepartmentId={departmentId}
        onCreated={(emp) => onSelect(emp)}
      />
    </>
  );
}
