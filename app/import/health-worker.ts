const WANTED = new Set([
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierSleepAnalysis',
])

const SLEEP_ASLEEP = new Set([
  'HKCategoryValueSleepAnalysisAsleep',
  'HKCategoryValueSleepAnalysisAsleepCore',
  'HKCategoryValueSleepAnalysisAsleepDeep',
  'HKCategoryValueSleepAnalysisAsleepREM',
])

function attr(tag: string, name: string): string {
  const i = tag.indexOf(name + '="')
  if (i === -1) return ''
  const start = i + name.length + 2
  const end = tag.indexOf('"', start)
  return end === -1 ? '' : tag.slice(start, end)
}

function parse(text: string) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const acc: Record<string, {
    hrv: number[]
    resting_hr: number[]
    steps: number
    sleepMs: number
  }> = {}

  function slot(date: string) {
    if (!acc[date]) acc[date] = { hrv: [], resting_hr: [], steps: 0, sleepMs: 0 }
    return acc[date]
  }

  const re = /<Record\b[^>]+\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const tag  = m[0]
    const type = attr(tag, 'type')
    if (!WANTED.has(type)) continue

    const startDate = attr(tag, 'startDate')
    const date = startDate.slice(0, 10)
    if (date < cutoffStr) continue

    if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
      slot(date).hrv.push(parseFloat(attr(tag, 'value')))
    } else if (type === 'HKQuantityTypeIdentifierRestingHeartRate') {
      slot(date).resting_hr.push(parseFloat(attr(tag, 'value')))
    } else if (type === 'HKQuantityTypeIdentifierStepCount') {
      slot(date).steps += parseFloat(attr(tag, 'value'))
    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      if (SLEEP_ASLEEP.has(attr(tag, 'value'))) {
        const endDate = attr(tag, 'endDate')
        const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
        slot(endDate.slice(0, 10)).sleepMs += ms
      }
    }
  }

  return Object.entries(acc)
    .map(([date, d]) => ({
      date,
      hrv: d.hrv.length > 0 ? Math.round(d.hrv.reduce((a, b) => a + b, 0) / d.hrv.length) : null,
      resting_hr: d.resting_hr.length > 0 ? Math.round(d.resting_hr[d.resting_hr.length - 1]) : null,
      steps: d.steps > 0 ? Math.round(d.steps) : null,
      sleep_hours: d.sleepMs > 0 ? Math.round(d.sleepMs / 360000) / 10 : null,
      sleep_performance: d.sleepMs > 0 ? Math.min(Math.round((d.sleepMs / 3600000 / 8) * 100), 100) : null,
    }))
    .filter(d => d.hrv || d.resting_hr || d.steps || d.sleep_hours)
    .sort((a, b) => b.date.localeCompare(a.date))
}

self.addEventListener('message', (e: MessageEvent) => {
  try {
    self.postMessage({ ok: true, data: parse(e.data.text) })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) })
  }
})
