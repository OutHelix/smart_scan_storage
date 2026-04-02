# Smart Scan Storage

Хранилище сканов документов с веб-интерфейсом на React и backend API на FastAPI.

## Минимальные требования

- Docker 24+
- Docker Compose v2 (`docker compose`)
- Рекомендуется не менее 8 GB RAM, так как backend содержит ML-зависимости

## Что запускается

- `frontend` — UI, доступен на `http://localhost:5173`
- `backend` — API и healthcheck, доступен на `http://localhost:8000`

## Мониторинг

В backend добавлены:

- логирование HTTP-запросов
- healthcheck `GET /health`
- базовые метрики нагрузки:
  - время ответа запросов в логах
  - состояние сервиса через `GET /health`

## Запуск одной командой

Из корня проекта выполните:

```bash
docker compose up --build
```

После старта будут доступны:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:5173/docs`
- Healthcheck: `http://localhost:8000/health`

## Остановка

```bash
docker compose down
```

Если нужно удалить том с базой данных и загруженными файлами:

```bash
docker compose down -v
```

## Данные

В `docker-compose.yml` подключён именованный том `backend_data`. В нём сохраняются:

- SQLite-база `/data/smart_scan_storage.db`
- загруженные документы `/data/uploads`
