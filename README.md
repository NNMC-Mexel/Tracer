# Трейсер чистоты — цифровой мониторинг гигиены рук

Веб-система для проведения аудитов («трейсеров») соблюдения гигиены рук.
Аудиторы заходят под своим логином, выбирают сотрудника, заполняют опросник
(по категории персонала), система автоматически считает результат и собирает
единую статистику.

## Стек

- **Backend:** Strapi v5 (TypeScript) — `backend/`
- **Frontend:** Next.js (TypeScript) + Ant Design — `frontend/`
- **БД:** SQLite локально (без Docker) / PostgreSQL в продакшене (Coolify)

## Роли

- **Administrator** — справочники и настройки
- **Auditor** — проведение трейсеров
- **Manager** — просмотр отчётов

## Быстрый старт (локальная разработка)

```bash
# 1. Установить зависимости (один раз)
npm run install:all

# 2. Запустить backend и frontend вместе
npm run dev
```

- Strapi admin: http://localhost:1337/admin
- Frontend: http://localhost:3100

Локально используется SQLite — никакой внешней БД ставить не нужно.
Фронтенд закреплён за портом **3100**, чтобы не конфликтовать с другими
локальными приложениями.

## Деплой (Coolify)

Монорепо разворачивается как **3 ресурса**: PostgreSQL + 2 приложения.

**1. PostgreSQL** — отдельный ресурс. Взять внутренний `DATABASE_URL`.

**2. Backend (Strapi)** — приложение, Base Directory `/backend`:

```
NODE_ENV=production
HOST=0.0.0.0
PORT=<порт, напр. 14003>          # Strapi слушает PORT из env
URL=https://<домен-бэкенда>        # публичный адрес за прокси
APP_KEYS=...                       # секреты — из backend/.env
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
JWT_SECRET=...
ENCRYPTION_KEY=...
DATABASE_CLIENT=postgres
DATABASE_URL=<внутренний URL postgres>
DATABASE_SSL=false
```
Build: `npm run build`, Start: `npm run start`.

**3. Frontend (Next.js)** — приложение, Base Directory `/frontend`:

```
PORT=<порт, напр. 14004>           # next start слушает PORT из env
NEXT_PUBLIC_STRAPI_URL=https://<домен-бэкенда>
```
Build: `npm run build`, Start: `npm run start`.

Порты обоих приложений берутся из переменной `PORT` — хардкода нет.
БД через `DATABASE_URL`; переключение SQLite→Postgres не требует правок кода.

## Структура

```
.
├── backend/        # Strapi (API, content-types, расчёт результатов)
├── frontend/       # Next.js + Ant Design (UI аудитора и отчёты)
└── package.json    # корневые скрипты (dev, build, install)
```

## Доменная модель (план)

| Сущность | Назначение |
|---|---|
| Department | структурное подразделение |
| StaffCategory | категория персонала → определяет опросник |
| Position | должность |
| Employee | сотрудник (справочник, поиск по ФИО) |
| Questionnaire | опросник для категории |
| Criterion | критерий/вопрос опросника |
| Tracer | проведённая проверка (со снимком данных) |
| Setting | пороги результатов и получатели уведомлений |

Расчёт результата выполняется на сервере (Strapi lifecycle), история хранится
со снимком ФИО/должности и текста вопросов на момент проверки (требование ≥3 лет).
