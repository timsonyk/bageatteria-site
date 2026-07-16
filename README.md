# Bageatteria

Сайт-витрина ресторана [bageatteria.com](https://bageatteria.com): статический лендинг, онлайн-меню и админка для управления каталогом.

## Архитектура

Монорепозиторий, три приложения + инфраструктура, всё разворачивается через Docker Compose за одним nginx:

| Домен | Приложение | Технологии |
|---|---|---|
| `bageatteria.com` | Публичный сайт (корень репо) | Next.js 16 (App Router, standalone), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| `api.bageatteria.com` | API — `backend/` | Python, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 15 |
| `admin.bageatteria.com` | Админка — `admin/` | Vite, React 19, TypeScript, Ant Design 6, TanStack Query |

Маршрутизация nginx (`deploy/nginx/`): корень `bageatteria.com/` отдаёт статический лендинг из `static/index.html`, всё остальное (`/menu`, `/menu/[slug]`, `/privacy`) проксируется в Next.js. Наружу открыты только 80/443.

## Функционал

- **Меню**: категории, товары с фото, КБЖУ, весом, размерами и модификаторами; избранное (localStorage); фильтр доступности по точкам продаж.
- **Админка**: вход по логину/паролю (bcrypt, cookie-сессия), CRUD категорий и товаров, drag-n-drop сортировка, кроп и сжатие фото при загрузке, размеры, модификаторы, рекомендации, точки продаж.
- **API**: публичные роуты `/catalog/*`, приватные `/admin/*` (cookie-авторизация), `/uploads` — фото товаров.

## Структура репозитория

```
├── src/                  # Next.js — публичный сайт (меню)
├── public/               # статика Next.js
├── static/               # лендинг (index.html + limg/) — отдаётся nginx-ом напрямую
├── admin/                # админка (Vite + React + Ant Design)
├── backend/
│   ├── app/
│   │   ├── api/routes/   # catalog.py (публичное), admin.py (админка)
│   │   ├── models/       # SQLAlchemy-модели каталога
│   │   ├── schemas/      # Pydantic-схемы
│   │   ├── core/         # config, security, rate limiting
│   │   └── services/     # гео-хелперы зон доставки
│   ├── migrations/       # Alembic
│   └── scripts/          # hash_admin_password, сиды/импорт каталога
├── deploy/nginx/         # конфиги nginx (reverse-proxy + SSL)
└── docker-compose.prod.yml
```

## Локальная разработка

**Бэкенд + БД** (Docker):

```bash
cd backend
cp env.example .env
docker compose up -d          # postgres + fastapi на :8000
docker compose exec backend alembic upgrade head
```

**Сайт** (нужен запущенный бэкенд):

```bash
npm install
npm run dev                   # http://localhost:3000
```

**Админка**:

```bash
cd admin
npm install
npm run dev                   # http://localhost:5173
```

## Продакшен

Сборка и запуск — `docker-compose.prod.yml` (nginx, site, backend, admin, db, certbot). Секреты — в `backend/.env` (шаблон: `backend/env.example.prod`), URL API зашивается во фронтенды на этапе сборки через build args.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head   # при изменении моделей
```

Первичная установка на чистый сервер — `deploy/deploy.sh` (Docker + сертификаты Let's Encrypt).

## Безопасность

- CORS — строгий allowlist из env; в production пустой список = ошибка запуска.
- Rate limiting на двух уровнях: nginx (`limit_req`) и slowapi в приложении.
- Security-заголовки middleware-ом (nosniff, X-Frame-Options, Referrer-Policy, HSTS).
- Пароль админки хранится только как bcrypt-хэш (`python -m scripts.hash_admin_password`).
- Загрузка файлов: allowlist расширений/MIME, лимит 20 МБ, пережатие через Pillow.

## Ветки

- `main` — актуальный код, только работающий функционал.
- `archive/full-version` — полная версия с заказами, оплатой (CloudPayments), лояльностью, СМС-авторизацией, складским учётом и Telegram-ботами. Вырезано из main 16.07.2026 как неиспользуемое; при необходимости возвращается оттуда (пустые таблицы под этот функционал в БД сохранены).
