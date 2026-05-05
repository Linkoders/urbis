# URBIS

Marketplace comunitario para conjuntos y emprendimientos.

## Requisitos

- Node.js 20+
- npm

## Instalación

```bash
npm install
```

## Variables de entorno (equipo)

Este repositorio **sí comparte** la plantilla `.env.example`, pero **no** sube secretos reales.

1. Copia la plantilla:

```bash
cp .env.example .env.local
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

2. Completa en `.env.local` tus valores reales (`DATABASE_URL`, `RESEND_API_KEY`, etc.).

3. No subas `.env.local` al repositorio.

## Desarrollo

```bash
npm run dev
```

Abrir: `http://localhost:3000`

## Lint

```bash
npm run lint
```

## Nota sobre `data/urbis-db.json`

- Es el respaldo/local store cuando no hay `DATABASE_URL`.
- Si configuras `DATABASE_URL`, la app usa la base de datos relacional y este JSON deja de ser la fuente principal.
