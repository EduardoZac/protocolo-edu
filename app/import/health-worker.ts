const WANTED_TYPES = [
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierSleepAnalysis',
]

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

type Acc = Record<string, { hrv: number[]; resting_hr: number[]; steps: number; sleepMs: number }>

function processChunk(text: string, cutoffStr: string, acc: Acc) {
  let i = 0
  while (true) {
    const start = text.indexOf('<Record ', i)
    if (start === -1) break
    const end = text.indexOf('/>', start)
    if (end === -1) break
    const tag = text.slice(start, end + 2)
    i = end + 2

    // Fast pre-filter — skip if none of our keywords present
    let matched = false
    for (const t of WANTED_TYPES) {
      if (tag.indexOf(t) !== -1) { matched = true; break }
    }
    if (!matched) continue

    const type = attr(tag, 'type')
    const startDate = attr(tag, 'startDate')
    const date = startDate.slice(0, 10)
    if (date < cutoffStr) continue

    if (!acc[date]) acc[date] = { hrv: [], resting_hr: [], steps: 0, sleepMs: 0 }
    const d = acc[date]

    if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
      d.hrv.push(parseFloat(attr(tag, 'value')))
    } else if (type === 'HKQuantityTypeIdentifierRestingHeartRate') {
      d.resting_hr.push(parseFloat(attr(tag, 'value')))
    } else if (type === 'HKQuantityTypeIdentifierStepCount') {
      d.steps += parseFloat(attr(tag, 'value'))
    } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      if (SLEEP_ASLEEP.has(attr(tag, 'value'))) {
        const endDate = attr(tag, 'endDate')
        const ms = new Date(endDate).getTime() - new Date(startDate).getTime()
        const wakeDate = endDate.slice(0, 10)
        if (!acc[wakeDate]) acc[wakeDate] = { hrv: [], resting_hr: [], steps: 0, sleepMs: 0 }
        acc[wakeDate].sleepMs += ms
      }
    }
  }
}

function buildResult(acc: Acc) {
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

self.addEventListener('message', async (e: MessageEvent) => {
  const file: File = e.data.file

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Read the entire file — Apple Health stores step/HR data before WHOOP
  // sleep/HRV data, so we can't just read from the end.
  // Our fast string-search parser handles large files without blocking UI.
  const CHUNK = 10 * 1024 * 1024  // 10 MB at a time
  const total = file.size

  const acc: Acc = {}
  let remainder = ''
  let offset = 0

  try {
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK, file.size)
      const text = await file.slice(offset, end).text()
      const combined = remainder + text

      // Keep incomplete record at boundary for next chunk
      const lastOpen = combined.lastIndexOf('<Record ')
      const lastClose = combined.lastIndexOf('/>')
      let toProcess: string
      if (lastOpen > lastClose) {
        toProcess = combined.slice(0, lastOpen)
        remainder = combined.slice(lastOpen)
      } else {
        toProcess = combined
        remainder = ''
      }

      processChunk(toProcess, cutoffStr, acc)
      offset = end

      const pct = Math.round((offset / total) * 100)
      self.postMessage({ type: 'progress', pct })
    }

    if (remainder) processChunk(remainder, cutoffStr, acc)

    self.postMessage({ type: 'done', data: buildResult(acc) })
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) })
  }
})
