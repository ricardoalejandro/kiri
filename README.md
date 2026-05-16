# Kiri

CRM SaaS multi-tenant centrado en WhatsApp, ventas, contactos, leads, pipelines, tareas, bots, automatizaciones, documentos y almacenamiento de media.

## Arquitectura

```
┌─────────────┐     ┌─────────────────────────────────────────┐
│   Frontend  │     │              Backend Go                 │
│   Next.js   │────▶│  ┌─────────┐  ┌──────────────────────┐  │
│   :3000     │     │  │ Fiber   │  │     DevicePool       │  │
└─────────────┘     │  │ API     │  │  ┌────────────────┐  │  │
                    │  └────┬────┘  │  │ whatsmeow x200 │  │  │
                    │       │       │  │ connections    │  │  │
                    │  ┌────▼────┐  │  └────────────────┘  │  │
                    │  │WebSocket│  │  ┌────────────────┐  │  │
                    │  │  Hub    │  │  │ WhatsApp Pool  │  │  │
                    │  └─────────┘  │  │ + workers      │  │  │
                    └───────────────┴──┴────────────────┴──┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼────┐  ┌──────▼─────┐  ┌─────▼────┐
              │PostgreSQL│  │   Redis    │  │  MinIO   │
              │  :5432   │  │   :6379    │  │ S3 media │
              └──────────┘  └────────────┘  └──────────┘
```

## Stack Tecnologico

### Backend (Go)
- **Go 1.24** - Lenguaje principal y toolchain del modulo.
- **Fiber v2** - Framework HTTP.
- **whatsmeow** - Integracion directa con WhatsApp Web.
- **pgx v5** - Driver PostgreSQL nativo.
- **Redis** - Cache, sesiones y soporte operativo.
- **MinIO** - Almacenamiento S3-compatible para archivos y media.

### Frontend (Next.js)
- **Next.js 14** - React framework con App Router.
- **TypeScript** - Tipado estatico.
- **Tailwind CSS** - Estilos utility-first.
- **Lucide React** - Iconos.
- **Zustand** - Estado global.
- **Fabric.js, Nivo, XYFlow** - Edicion visual, graficos y flujos.

### Infraestructura
- **PostgreSQL 16** - Base de datos principal.
- **Redis 7** - Cache y mensajeria auxiliar.
- **MinIO** - Storage de media.
- **Docker Compose** - Orquestacion local/produccion.
- **Traefik** - Routing HTTPS en el compose de despliegue.

## Modulos Principales

- **WhatsApp y chats**: dispositivos, QR, mensajes, media, contactos, stickers, reacciones y WebSocket en tiempo real.
- **CRM comercial**: contactos, leads, pipelines, tags, interacciones, campañas y respuestas rapidas.
- **Automatizaciones y bots**: flujos visuales, ejecuciones, logs, simulacion y activacion por plan.
- **Documentos y storage**: plantillas, generacion de documentos, uso de almacenamiento, deduplicacion y media proxy.
- **Administracion SaaS**: cuentas, usuarios, roles, planes, suscripciones, integraciones y permisos por modulo.
- **Integraciones**: Google Contacts y WhatsApp Cloud API.

## Inicio Rapido

### Prerrequisitos
- Docker & Docker Compose.

### Con Docker

```bash
cp .env.example .env
make up
make logs
```

La aplicacion local queda disponible en:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Desarrollo

El desarrollo y la compilacion se hacen dentro de Docker. No instales Go ni Node en el host del VPS.

## Configuracion

Variables principales en `.env`:

```env
POSTGRES_USER=kiri
POSTGRES_PASSWORD=change-me
POSTGRES_DB=kiri

DATABASE_URL=postgres://kiri:change-me@localhost:5432/kiri?sslmode=disable
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me

PORT=8080
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080

MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=kiriadmin
MINIO_SECRET_KEY=change-me
MINIO_BUCKET=kiri-media
MINIO_USE_SSL=false
```

El compose de produccion contempla variables para Google Contacts, WhatsApp Cloud API, URLs publicas y storage.

## API

Las rutas se definen principalmente en `backend/internal/api/server.go`.

Grupos principales:
- Publico: `/health`, `/api/version`, `/api/public/plans` y webhooks de WhatsApp Cloud API.
- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/auth/logout`.
- Dashboard protegido: `/api/me`, `/api/settings`, `/api/storage`, `/api/devices`, `/api/chats`, `/api/messages`, `/api/contacts`, `/api/leads`, `/api/pipelines`, `/api/tags`, `/api/campaigns`, `/api/tasks`, `/api/document-templates`, `/api/quick-replies`, `/api/bots`, `/api/automations`.
- Integraciones: `/api/google`, `/api/google/contacts`, `/api/whatsapp-api`.
- Admin SaaS: `/api/admin/*`.
- WebSocket: `/ws?token=<jwt>`.

## Comandos Make

```bash
make up             # Levantar servicios
make down           # Detener servicios
make logs           # Ver logs
make restart        # Reiniciar servicios
make db             # Solo postgres, redis y dependencias basicas
make build          # Construir imagenes
make migrate        # Ejecutar migraciones via backend
make seed           # Ejecutar seed via backend
make test           # go test ./...
make deploy         # Build con version y despliegue backend/frontend
```

## Estructura del Proyecto

```
kiri/
├── backend/
│   ├── cmd/server/        # Entry point
│   ├── internal/
│   │   ├── api/           # HTTP handlers y rutas
│   │   ├── domain/        # Entidades y contratos internos
│   │   ├── repository/    # Acceso a datos
│   │   ├── service/       # Logica de negocio
│   │   ├── whatsapp/      # DevicePool + whatsmeow
│   │   ├── google/        # Google Contacts
│   │   ├── storage/       # MinIO/S3
│   │   └── ws/            # WebSocket Hub
│   └── pkg/
│       ├── config/        # Configuracion
│       ├── database/      # DB, migraciones y seed
│       └── cache/         # Redis
├── frontend/
│   └── src/
│       ├── app/           # App Router y paginas dashboard/publicas
│       ├── components/    # Componentes UI
│       ├── lib/           # API client y utilidades
│       ├── types/         # Tipos frontend
│       └── utils/         # Helpers de dominio
├── deploy/                # Dockerfiles
├── specs/                 # Specs historicas de features
├── docker-compose.yml
└── Makefile
```

## Multi-tenancy y Seguridad

- Las cuentas funcionan como tenants aislados por `account_id`.
- Los usuarios pueden pertenecer a una o mas cuentas.
- Hay roles, permisos por modulo y middleware de plan/suscripcion.
- Las contrasenas se almacenan con bcrypt.
- La autenticacion usa JWT y refresh tokens.
- El backend aplica CORS, Helmet y rate limiting.

## Nota sobre el estado del repositorio

Si `git status` muestra muchos cambios, no los reviertas sin revisar su origen. En este proyecto hay cambios grandes y coherentes en backend, frontend, Docker, storage, login/signup y tests; eso normalmente indica trabajo activo. La recomendacion es:

1. Revisar con `git diff --stat` para ver el alcance.
2. Separar cambios por tema antes de commitear.
3. Stashear o crear una rama solo si necesitas aislar una correccion nueva.
4. No usar `git reset --hard` salvo que se haya decidido descartar explicitamente ese trabajo.

## Licencia

MIT
