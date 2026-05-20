# RetailPOS

Sistema POS / ERP retail hecho con **Next.js 16**, **Prisma 7**, **PostgreSQL** y **Auth.js**.

## Stack

- Next.js 16
- React 19
- Prisma 7 + `@prisma/adapter-pg`
- PostgreSQL
- Tailwind CSS

---

## Requisitos

Antes de arrancar necesitás:

- **Node.js >= 20.9**
- **npm**
- **Docker** + `docker compose`

> Este repo hoy usa Docker **solo para la base de datos local**. La app corre localmente con `npm run dev`.

---

## Instalación desde Windows

### Opción recomendada

Usá:

- **Windows 10/11**
- **PowerShell**
- **Docker Desktop**
- **Node.js LTS**

### 1. Instalar Node.js

Descargalo desde:

```text
https://nodejs.org/
```

Instalá la versión **LTS**.

Después verificá en PowerShell:

```powershell
node -v
npm -v
```

### 2. Instalar Docker Desktop

Descargalo desde:

```text
https://www.docker.com/products/docker-desktop/
```

Después verificá:

```powershell
docker -v
docker compose version
```

### 3. Clonar el repo

```powershell
git clone <URL_DEL_REPO>
cd novapos
```

### 4. Instalar dependencias

```powershell
npm install
```

### 5. Levantar PostgreSQL con Docker

```powershell
docker compose up -d postgres
```

### 6. Crear `.env.local`

Podés crearlo manualmente en la raíz del proyecto con este contenido:

```env
DATABASE_URL="postgresql://retailpos:retailpos123@127.0.0.1:5433/retailpos"
DIRECT_URL="postgresql://retailpos:retailpos123@127.0.0.1:5433/retailpos"

AUTH_SECRET="cambia-esto-por-un-secret-largo"
AUTH_URL="http://127.0.0.1:3000"
```

### 7. Preparar la base

```powershell
npm run db:push
npm run db:seed
```

### 8. Levantar la app

```powershell
npm run dev
```

Abrí:

```text
http://127.0.0.1:3000
```

### 9. Problemas comunes en Windows

#### Puerto 5433 ocupado

Si ya tenés otro PostgreSQL corriendo, el contenedor puede fallar.
Verificalo y liberá ese puerto o cambiá el mapeo en `docker-compose.yml`.

#### Docker no arranca

Asegurate de que Docker Desktop esté abierto antes de correr:

```powershell
docker compose up -d postgres
```

#### Variables no tomadas

Si cambiaste `.env.local`, reiniciá el server:

```powershell
Ctrl + C
npm run dev
```

#### Prisma no encuentra la base

Probá primero que el contenedor esté arriba:

```powershell
docker ps
```

Y después corré:

```powershell
npm run db:generate
npm run db:push
```

---

## Levantar el proyecto en local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar PostgreSQL con Docker

```bash
docker compose up -d postgres
```

Esto levanta una base local con estos datos:

- host: `127.0.0.1`
- port: `5433`
- database: `retailpos`
- user: `retailpos`
- password: `retailpos123`

### 3. Crear `.env.local`

Usá algo así para desarrollo local:

```env
DATABASE_URL="postgresql://retailpos:retailpos123@127.0.0.1:5433/retailpos"
DIRECT_URL="postgresql://retailpos:retailpos123@127.0.0.1:5433/retailpos"

AUTH_SECRET="cambia-esto-por-un-secret-largo"
AUTH_URL="http://127.0.0.1:3000"
```

> `prisma.config.ts` usa `DIRECT_URL` primero y cae en `DATABASE_URL` si hace falta.

### 4. Sincronizar schema y seed

Si querés dejar la base lista rápido:

```bash
npm run db:push
npm run db:seed
```

Si preferís trabajar con migraciones:

```bash
npm run db:migrate
```

### 5. Levantar la app

```bash
npm run dev
```

Abrí:

```text
http://127.0.0.1:3000
```

---

## Credenciales de prueba

Después del seed, podés entrar con:

- `admin@retailpos.com / admin123`
- `manager@retailpos.com / manager123`

---

## Scripts útiles

```bash
npm run dev                # app en modo desarrollo
npm run lint               # lint
npm run db:generate        # genera cliente Prisma
npm run db:push            # sync schema a la DB
npm run db:migrate         # crea y aplica migración local
npm run db:deploy          # aplica migraciones existentes
npm run db:seed            # carga datos iniciales
npm run db:studio          # abre Prisma Studio
npm run db:bootstrap-admin # crea/actualiza admin manualmente
```

---

## Flujo recomendado de desarrollo local

1. Levantar Postgres con Docker
2. Crear `.env.local`
3. Ejecutar `npm run db:push`
4. Ejecutar `npm run db:seed`
5. Ejecutar `npm run dev`

---

## Producción / Supabase

Para producción ya existe referencia en:

- `.env.example`
- `docs/vercel-supabase-setup.md`

Ahí está documentado:

- uso de `DATABASE_URL` con pooler de Supabase
- uso de `DIRECT_URL` para Prisma CLI
- bootstrap del admin
- migraciones manuales vía SQL si hicieran falta

---

## Notas importantes

- La pantalla principal ahora es **Caja**.
- Para cobrar desde POS necesitás una **caja abierta**.
- Docker hoy no levanta la app, solo la base.
- Si cambia el schema de Prisma, corré:

```bash
npm run db:generate
```

si hiciera falta regenerar el cliente manualmente.
