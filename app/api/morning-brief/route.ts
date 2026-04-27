import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  const isCron = secret && secret === process.env.HEALTH_SYNC_SECRET
  let userId: string | null = null

  if (isCron) {
    const supabase = admin()
    const { data } = await supabase.auth.admin.listUsers()
    userId = data?.users?.[0]?.id ?? null
  } else {
    const body = await req.json().catch(() => ({}))
    userId = body.userId ?? null
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - 4 * 86400_000).toISOString().slice(0, 10)
  const supabase = admin()

  const [{ data: logs }, { data: fasts }] = await Promise.all([
    supabase.from('daily_logs').select('*').eq('user_id', userId)
      .gte('date', since).order('date', { ascending: true }),
    supabase.from('fasts').select('*').eq('user_id', userId)
      .not('ended_at', 'is', null)
      .gte('started_at', new Date(Date.now() - 5 * 86400_000).toISOString())
      .order('started_at', { ascending: true }),
  ])

  const todayLog = logs?.find(l => l.date === today)
  const yesterday = logs?.[logs.length - (todayLog ? 2 : 1)]

  const fastLines = (fasts ?? []).map(f => {
    const h = (new Date(f.ended_at).getTime() - new Date(f.started_at).getTime()) / 3600000
    return `  ${f.started_at.slice(0, 10)}: ${Math.round(h * 10) / 10}h ${f.goal_reached ? '✓' : '✗'}`
  }).join('\n') || '  Sin datos'

  const logLines = (logs ?? []).map(l =>
    `  ${l.date}: HRV=${l.hrv ?? '—'}ms, Rec=${l.recovery_score ?? '—'}%, Sleep=${l.sleep_performance ?? '—'}%, Strain=${l.strain ?? '—'}, Energía=${l.energy ?? '—'}/10, Colores=${(l.colors ?? []).length}/7${l.notes ? `\n    Nota: ${l.notes}` : ''}`
  ).join('\n') || '  Sin datos'

  const ctx = `
HOY ES ${today}.

MÉTRICAS RECIENTES (últimos 4 días):
${logLines}

AYUNOS RECIENTES:
${fastLines}

HOY (al despertar):
  HRV: ${todayLog?.hrv ?? '—'}ms
  Recovery: ${todayLog?.recovery_score ?? '—'}%
  Sleep: ${todayLog?.sleep_performance ?? '—'}%

AYER:
  Strain: ${yesterday?.strain ?? '—'}
  Energía reportada: ${yesterday?.energy ?? '—'}/10
  Colores comidos: ${(yesterday?.colors ?? []).join(', ') || 'sin registro'}
`.trim()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: `Eres el coach de salud personal de Eduardo (Playa del Carmen, protocolo de longevidad: ayuno 14h+, arcoíris 7 colores, Whoop).

Umbrales: HRV ≥70 verde / 40-69 amarillo / <40 rojo. Recovery ≥67 verde / 34-66 amarillo / <34 rojo. Sleep ≥85 óptimo.

Genera un MORNING BRIEF corto, accionable, en español, con esta estructura EXACTA:

**Readiness**
1 frase con el estado del cuerpo hoy (recovery + HRV + sleep).

**Foco del día**
1-2 acciones concretas en función del recovery: si verde → empuja entrenamiento/cognitivo; si amarillo → mantén; si rojo → recupera (sueño, comida, menos café).

**Ventana de ayuno**
1 frase recomendando ventana de hoy basada en últimos ayunos y recovery.

**Insight**
1 correlación o patrón que detectes entre los datos (ayuno↔recovery, colores↔HRV, strain↔sleep). Si no hay datos suficientes, di "sin patrón claro aún".

Sin saludos. Sin emojis. Máximo 150 palabras totales.`,
    messages: [{ role: 'user', content: ctx }],
  })

  const text = response.content.find(b => b.type === 'text')?.text ?? ''

  await supabase.from('briefs').upsert({
    user_id: userId,
    kind: 'morning',
    date: today,
    content: text,
  }, { onConflict: 'user_id,kind,date' })

  return NextResponse.json({ ok: true, brief: text, date: today })
}
