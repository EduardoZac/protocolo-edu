import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Fetch last 7 days of data
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const dateStr = sevenDaysAgo.toISOString().slice(0, 10)

    const [{ data: logs }, { data: fasts }] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dateStr)
        .order('date', { ascending: true }),
      supabase
        .from('fasts')
        .select('*')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)
        .gte('started_at', sevenDaysAgo.toISOString())
        .order('started_at', { ascending: true }),
    ])

    if (!logs?.length && !fasts?.length) {
      return NextResponse.json({ summary: null, reason: 'no_data' })
    }

    // Build data summary for Claude
    const fastDurations = fasts?.map(f => {
      const hours = (new Date(f.ended_at!).getTime() - new Date(f.started_at).getTime()) / 3600000
      return { date: f.started_at.slice(0, 10), hours: Math.round(hours * 10) / 10, goal: f.goal_reached }
    }) ?? []

    // Color label map
    const COLOR_LABELS: Record<string, string> = {
      rojo: 'Rojo (jitomate, fresa, pimiento)',
      naranja: 'Naranja (zanahoria, naranja, mango)',
      amarillo: 'Amarillo (limón, maíz, piña)',
      verde: 'Verde (espinaca, pepino, aguacate)',
      crucifero: 'Crucífero (brócoli, col, kale)',
      morado: 'Morado (arándano, berenjena, uva)',
      blanco: 'Blanco (ajo, cebolla, nueces)',
    }
    const ALL_COLORS = Object.keys(COLOR_LABELS)

    const logSummary = logs?.map(l => ({
      date: l.date,
      hrv: l.hrv,
      recovery: l.recovery_score,
      sleep: l.sleep_performance,
      steps: l.steps,
      resting_hr: l.resting_hr,
      energy: l.energy,
      colorsEaten: (l.colors ?? []) as string[],
      colorsMissed: ALL_COLORS.filter(c => !(l.colors ?? []).includes(c)),
    })) ?? []

    // Weekly color frequency
    const colorFrequency: Record<string, number> = {}
    for (const c of ALL_COLORS) {
      colorFrequency[c] = logSummary.filter(l => l.colorsEaten.includes(c)).length
    }
    const consistentColors = ALL_COLORS.filter(c => colorFrequency[c] >= 5)
    const missingColors = ALL_COLORS.filter(c => colorFrequency[c] === 0)
    const rareColors = ALL_COLORS.filter(c => colorFrequency[c] > 0 && colorFrequency[c] < 3)

    // Compute quick correlations for Claude context
    const withHrv = logSummary.filter(l => l.hrv && l.sleep)
    const avgHrvHighSleep = withHrv.filter(l => l.sleep! >= 85).map(l => l.hrv!).reduce((a, b, _, arr) => a + b / arr.length, 0)
    const avgHrvLowSleep = withHrv.filter(l => l.sleep! < 85).map(l => l.hrv!).reduce((a, b, _, arr) => a + b / arr.length, 0)

    const goalFastCount = fastDurations.filter(f => f.goal).length
    const avgFastHours = fastDurations.reduce((a, f) => a + f.hours, 0) / (fastDurations.length || 1)
    const avgRecovery = logSummary.filter(l => l.recovery).map(l => l.recovery!).reduce((a, b, _, arr) => a + b / arr.length, 0)
    const avgHrv = logSummary.filter(l => l.hrv).map(l => l.hrv!).reduce((a, b, _, arr) => a + b / arr.length, 0)

    const dataContext = `
DATOS DE LA SEMANA (${dateStr} a hoy):

AYUNOS (${fastDurations.length} total, ${goalFastCount} ≥14h):
${fastDurations.map(f => `  ${f.date}: ${f.hours}h ${f.goal ? '✓' : '✗'}`).join('\n') || '  Sin datos'}

MÉTRICAS DIARIAS:
${logSummary.map(l =>
  `  ${l.date}: HRV=${l.hrv ?? '—'}ms, Rec=${l.recovery ?? '—'}%, Sleep=${l.sleep ?? '—'}%, Steps=${l.steps ?? '—'}, Energía=${l.energy ?? '—'}/10
    Colores comidos: ${l.colorsEaten.length > 0 ? l.colorsEaten.join(', ') : 'ninguno'}
    Colores faltantes: ${l.colorsMissed.length > 0 ? l.colorsMissed.join(', ') : 'todos cubiertos ✓'}`
).join('\n') || '  Sin datos'}

RESUMEN DE COLORES (arcoíris semanal):
  Consistentes (≥5 días): ${consistentColors.map(c => COLOR_LABELS[c]).join(', ') || 'ninguno'}
  Nunca comidos esta semana: ${missingColors.map(c => COLOR_LABELS[c]).join(', ') || 'ninguno — ¡perfecto!'}
  Poco frecuentes (<3 días): ${rareColors.map(c => COLOR_LABELS[c]).join(', ') || 'ninguno'}

PROMEDIOS SEMANALES:
  HRV promedio: ${avgHrv ? Math.round(avgHrv) + 'ms' : '—'}
  Recovery promedio: ${avgRecovery ? Math.round(avgRecovery) + '%' : '—'}
  Ayuno promedio: ${fastDurations.length ? Math.round(avgFastHours * 10) / 10 + 'h' : '—'}
${withHrv.length >= 2 && avgHrvHighSleep && avgHrvLowSleep ? `
CORRELACIÓN SUEÑO-HRV detectada:
  HRV en días con sueño ≥85%: ${Math.round(avgHrvHighSleep)}ms
  HRV en días con sueño <85%: ${Math.round(avgHrvLowSleep)}ms
  Diferencia: ${Math.round(avgHrvHighSleep - avgHrvLowSleep)}ms` : ''}
`.trim()

    // Guard: ANTHROPIC_API_KEY must be set
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' }, { status: 500 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Eres el coach de salud personal de Eduardo, quien vive en Playa del Carmen y sigue un protocolo de longevidad basado en:

PROTOCOLO DE EDUARDO:
- Ayuno intermitente: meta 14h diarias, 5 días/semana. ≥16h es bonus. El ayuno activa sirtuinas, autofagia (empieza ~16-18h), mejora metabolismo.
- Alimentación arcoíris: 7 colores al día = 7 grupos de polifenoles distintos. Los polifenoles activan las mismas vías de longevidad que el ayuno. Un plato beige es una oportunidad perdida.
  • Rojo: jitomate, fresa, pimiento → licopeno, antocianinas
  • Naranja: zanahoria, naranja, mango → betacaroteno
  • Amarillo: limón, maíz, piña → luteína, zeaxantina
  • Verde: espinaca, pepino, aguacate → clorofila, folato
  • Crucífero: brócoli, col, kale → sulforafano (el más potente)
  • Morado: arándano, berenjena, uva → resveratrol, antocianinas
  • Blanco: ajo, cebolla, nueces → alicina, quercetina
- HRV (WHOOP): >70ms = verde, 40-70ms = amarillo, <40ms = rojo. Es el indicador más sensible de recuperación.
- Recovery WHOOP: >67% = verde, 34-67% = amarillo, <34% = rojo.
- Sleep performance: >85% = óptimo.

Analizas las métricas semanales de Eduardo de forma directa, honesta y motivadora.
Responde SIEMPRE en español. Usa emojis con moderación (1-2 máximo).
Formato: 3-4 párrafos cortos. Primero un resumen de cómo fue la semana (ayuno + métricas), luego interpreta los colores de alimentación (qué faltó, qué estuvo bien, qué polifenoles perdió), luego cualquier correlación que detectes, y finalmente 1 recomendación concreta y accionable para la próxima semana.
Sé específico con los números. No uses listas con viñetas. Tono amigable pero directo.`,
      messages: [{ role: 'user', content: `Analiza mi semana:\n\n${dataContext}` }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    return NextResponse.json({ summary: text })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('weekly-summary error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
