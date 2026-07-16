# Bageatteria — документация (текущее состояние)

> Актуально на 16.07.2026. Сервер: VPS nic.ru, `89.111.165.225` (Ubuntu 22.04, 2 GB RAM).
> Код: `/root/bageatteria`, git-репозиторий `github.com:timsonyk/bageatteria-site`.

## Что сейчас работает

Сайт-витрина ресторана: **лендинг + онлайн-меню** (231 товар, 14 категорий) и **админка для управления каталогом**. Заказов, оплаты и личных кабинетов на сайте нет.

## Docker-контейнеры (`docker-compose.prod.yml`)

Наружу открыты только 80/443 у nginx, остальное общается по внутренней docker-сети:

| Контейнер | Образ | Порт | Роль |
|---|---|---|---|
| `bageatteria-nginx-1` | nginx:alpine | 80/443 наружу | Reverse-proxy, SSL, статика лендинга |
| `bageatteria-site-1` | сборка из корня репо | 3000 internal | Next.js — лендинг и меню |
| `bageatteria-backend-1` | сборка `backend/` | 8000 internal | FastAPI — API каталога и админки |
| `bageatteria-admin-1` | сборка `admin/` | 80 internal | Админка (статика) |
| `bageatteria-db-1` | postgres:15-alpine | 5432 internal | БД, volume `db_data` |

## Домены и маршрутизация

| Домен | Что отдаёт |
|---|---|
| `bageatteria.com` | `/` — статический лендинг (`static/index.html` через nginx); `/menu`, `/menu/[slug]`, `/privacy` — Next.js |
| `api.bageatteria.com` | FastAPI; `/uploads` — фото товаров (кэш 1 день) |
| `admin.bageatteria.com` | Админка; запросы `/admin`, `/auth`, `/me`, `/uploads` проксируются в бэкенд |

Везде HTTPS (Let's Encrypt, общий сертификат), HTTP → 301 на HTTPS, HSTS, rate limiting в nginx.

## Стек

**Публичный сайт** (корень репо)
- Next.js 16 (App Router, standalone), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui (@base-ui/react), lucide-react
- Страницы: лендинг (статика), меню с категориями, карточка товара (КБЖУ, размеры, фото)

**Бэкенд** (`backend/`)
- FastAPI + Uvicorn, SQLAlchemy 2 + Alembic (миграции), psycopg3, Pydantic 2
- Используемые роуты: `catalog` (публичное меню) и `admin` (управление каталогом)
- Вход в админку: логин + пароль (bcrypt-хэш в env), rate limiting через slowapi
- Фото товаров: `backend/uploads/` (volume), отдаются как `/uploads`

**Админка** (`admin/`)
- Vite + React 19 + TypeScript, Ant Design 6, TanStack Query, axios, react-router 7
- dnd-kit (сортировка категорий/товаров перетаскиванием), react-image-crop (кроп фото)

**БД** — PostgreSQL 15, юзер/БД `bageatteria`. Реально используются таблицы каталога:
- `categories` (14), `products` (231) — с КБЖУ (порционные + `*_per_100g`), весом, фото
- `product_sizes`, `modification_groups` / `modification_options` — размеры и модификаторы
- `app_texts`, `faqs` — тексты и FAQ

Неиспользуемый функционал (заказы, платежи, лояльность, СМС-авторизация, склад, push, Telegram-боты) **вырезан из кода 16.07.2026** и целиком сохранён в git-ветке **`archive/full-version`** — если понадобится, можно вернуть оттуда. Пустые таблицы под него в БД оставлены, они не мешают.

## Конфигурация

- Секреты — в `backend/.env` (не в git): Postgres, `SECRET_KEY`, `ADMIN_USERNAME`+`ADMIN_PASSWORD_HASH`, `CORS_ORIGINS`. Шаблон — `backend/env.example.prod`.
- URL API зашивается при сборке фронтов: `NEXT_PUBLIC_API_URL` / `VITE_API_URL` = `https://api.bageatteria.com` (build args в compose).
- Nginx-конфиги: `deploy/nginx/nginx.conf` + `deploy/nginx/sites/*.conf`.

## Безопасность

- CORS — строгий allowlist из env, wildcard в проде запрещён
- Security-заголовки middleware-ом (nosniff, X-Frame-Options, Referrer-Policy, HSTS)
- Rate limiting на двух уровнях: nginx + slowapi в приложении
- Пароль админки хранится только как bcrypt-хэш

## Команды

```bash
ssh -i ~/.ssh/id_ed25519 root@89.111.165.225
cd /root/bageatteria

# деплой после git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
# при изменении моделей БД
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# логи / рестарт
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml restart site

# консоль и дамп БД
docker exec -it bageatteria-db-1 psql -U bageatteria -d bageatteria
docker exec bageatteria-db-1 pg_dump -U bageatteria bageatteria > backups/dump_$(date +%Y%m%d).sql
```
