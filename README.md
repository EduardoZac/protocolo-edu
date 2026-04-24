# Protocolo · Edu

Dashboard personal de ayuno intermitente, arcoíris alimenticio y métricas WHOOP.

Stack: Next.js 14 · Supabase · Tailwind CSS · Vercel

---

## Setup en 30 minutos

### 1. Supabase — crear proyecto y base de datos

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta (gratis)
2. **New project** → nombre: `protocolo-edu` → genera una contraseña segura → región: `South America (São Paulo)` o `US East`
3. Espera ~2 minutos a que el proyecto levante
4. Ve a **SQL Editor** → **New query**
5. Pega el contenido completo de `supabase/schema.sql` → **Run**
6. Verifica en **Table Editor** que creó las tablas `fasts` y `daily_logs`

### 2. Supabase — crear tu usuario

1. En Supabase → **Authentication** → **Users** → **Add user**
2. Usa tu email real y una contraseña segura
3. Guarda esas credenciales — son las que usarás para entrar a la app

### 3. Supabase — obtener API keys

1. En Supabase → **Settings** → **API**
2. Copia `Project URL` → es tu `NEXT_PUBLIC_SUPABASE_URL`
3. Copia `anon public` key → es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Vercel — deploy

1. Sube este proyecto a GitHub (repositorio privado)
   ```bash
   git init
   git add .
   git commit -m "init"
   gh repo create protocolo-edu --private --push --source=.
   ```
2. Ve a [vercel.com](https://vercel.com) → **New Project** → importa el repo
3. En **Environment Variables** agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` → el valor que copiaste
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → el valor que copiaste
4. **Deploy** → Vercel hace el build automático
5. En ~1 minuto tienes la URL: `https://protocolo-edu.vercel.app`

### 5. Desarrollo local (opcional)

```bash
npm install
cp .env.local.example .env.local
# Edita .env.local con tus valores reales
npm run dev
# Abre http://localhost:3000
```

---

## Estructura del proyecto

```
app/
  login/page.tsx          — Login con email/password
  dashboard/
    page.tsx              — Dashboard principal (tabs: Hoy | Historia)
    FastingTimer.tsx      — Temporizador con progreso circular, persiste en DB
    RainbowTracker.tsx    — 7 colores, click para marcar, guarda automático
    WhoopLogger.tsx       — Entrada manual: Recovery, HRV, Sueño, Strain
    DailyNote.tsx         — Nota del día + energía 1-5, guarda automático
    HistoryView.tsx       — Barras de ayuno + tabla WHOOP últimos 30 días
lib/
  supabase.ts             — Cliente Supabase para browser
  types.ts                — Interfaces TypeScript + helpers de color WHOOP
middleware.ts             — Protección de rutas, redirige si no autenticado
supabase/schema.sql       — Tablas + RLS + índices
```

---

## Cómo usar la app

**Hoy:**
- Toca **Iniciar ayuno** cuando termines de cenar (o cuando quieras empezar)
- El timer persiste aunque cierres el navegador
- Marca los colores del arcoíris conforme los vayas comiendo
- Ingresa tus métricas WHOOP al despertar (se guardan solos al escribir)
- Escribe tu nota del día y califica tu energía 1-5

**Historia:**
- Barras de ayuno con línea de meta (14h) — verde = meta alcanzada
- Tabla de métricas WHOOP con código de color (verde / amarillo / rojo)

---

## Umbrales WHOOP (en el código, `lib/types.ts`)

| Métrica | Verde | Amarillo | Rojo |
|---------|-------|----------|------|
| Recovery | ≥67% | 34–66% | <34% |
| HRV | ≥70ms | 40–69ms | <40ms |
| Sueño | ≥85% | 70–84% | <70% |
| Strain | — | — | escala 0–21 |

Para ajustar los umbrales: edita las funciones `recoveryColor`, `hrvColor`, etc. en `lib/types.ts`.

---

## Posibles extensiones futuras

- **Semana de racha**: mostrar cuántos días consecutivos con ≥14h de ayuno
- **Export CSV**: botón para descargar historial completo
- **Notificaciones**: recordatorio vía web push al llegar a 14h
- **API WHOOP**: cuando WHOOP abra su API pública, conectar automáticamente
- **Modo ciclo**: integrar training load con datos de ciclismo/running
