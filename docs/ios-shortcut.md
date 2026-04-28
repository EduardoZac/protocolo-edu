# iOS Shortcut → /api/health-sync

Configura un Shortcut en iOS que corre cada mañana a las 8 AM, lee de Apple Health y hace POST a:

```
POST https://protocolo-edu.vercel.app/api/health-sync
Header: x-sync-secret: <HEALTH_SYNC_SECRET>
Header: Content-Type: application/json
```

## Body JSON

Solo manda los campos que tengas. `date` es obligatorio.

```json
{
  "date": "2026-04-28",

  "_apple_health": "rellena los que tengas",
  "steps": 8421,
  "flights_climbed": 12,
  "distance_km": 6.2,
  "active_kcal": 524,
  "exercise_min": 45,
  "stand_hours": 11,
  "mindfulness_min": 15,
  "resting_hr": 58,

  "_antropometria_balanza_inteligente": "...",
  "weight_kg": 78.4,
  "body_fat_pct": 18.2,
  "lean_mass_kg": 64.1,
  "waist_cm": 86,

  "_glucosa_CGM_o_glucometro": "...",
  "glucose_avg": 92.3,
  "glucose_min": 71,
  "glucose_max": 138,
  "glucose_time_in_range": 94,

  "_cardiovasculares": "...",
  "bp_systolic": 118,
  "bp_diastolic": 76,
  "vo2_max": 48.5
}
```

## Campos disponibles

### Apple Health (built-in)
- `steps`, `flights_climbed`, `distance_km`
- `active_kcal`, `exercise_min`, `stand_hours`
- `mindfulness_min` (de la app Mindfulness)
- `resting_hr`

### Balanza inteligente (Withings, Renpho, Eufy → Apple Health)
- `weight_kg`, `body_fat_pct`, `lean_mass_kg`, `waist_cm`

### Glucosa (CGM como Dexcom/Libre, o glucómetro manual)
- `glucose_avg`, `glucose_min`, `glucose_max` — en mg/dL
- `glucose_time_in_range` — % del día entre 70-140 mg/dL

### Presión arterial (monitor BT)
- `bp_systolic`, `bp_diastolic`

### VO2max (Apple Watch lo calcula automático)
- `vo2_max`

## Cómo crear el Shortcut

1. Apple Shortcuts app → **+** nuevo Shortcut.
2. Add action **Find Health Samples** → tipo **Steps** → Today → Sum.
3. Set Variable `steps` con el resultado.
4. Repite para cada métrica que quieras.
5. Add action **Get Contents of URL**:
   - URL: `https://protocolo-edu.vercel.app/api/health-sync`
   - Method: POST
   - Headers: `x-sync-secret` = tu secreto, `Content-Type` = `application/json`
   - Request Body: JSON con todas las variables.
6. **Automation** → Time of Day → 8:00 AM → corre el shortcut sin pedir confirmación.
