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

    const logSummary = logs?.map(l => ({
      date: l.date,
      hrv: l.hrv,
      recovery: l.recovery_score,
      sleep: l.sleep_performance,
      steps: l.steps,
      resting_hr: l.resting_hr,
      energy: l.energy,
      colors: l.colors?.length ?? 0,
    })) ?? []

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
  `  ${l.date}: HRV=${l.hrv ?? '—'}ms, Rec=${l.recovery ?? '—'}%, Sleep=${l.sleep ?? '—'}%, Steps=${l.steps ?? '—'}, Energía=${l.energy ?? '—'}/10, Colores=${l.colors}/7`
).join('\n') || '  Sin datos'}

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
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      system: `Eres el coach de salud personal de Eduardo. Analizas sus métricas semanales de forma directa, honesta y motivadora.
Responde SIEMPRE en español. Usa emojis con moderación.
Formato: 3-4 párrafos cortos. Primero un resumen de cómo fue la semana, luego 1-2 correlaciones o patrones que detectes, y finalmente 1 recomendación concreta para la próxima semana.
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
