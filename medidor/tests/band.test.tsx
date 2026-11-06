import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'medidor', component: 'AbovePrompt', props: { hasSurvey: false } } as const

test('muestra gasto, reinicio y consejo', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const reset = new Date(1_000_000 + 2 * 3600_000 + 5 * 60_000).toISOString()
  await $.session.measure({ context: { window: 200000, tokens: 160000, percent: 80 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: reset }], cost: { usd: 1.5 }, changed: ['context'] })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /42% gastado.*2 h 5 min/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ABRE UNA NUEVA/ })).toBeDefined()
    await ui.unmount()
  }
})

test('deja sitio a lo que dibujan otros mods en la misma franja', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>otro mod</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /otro mod/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Límite 5 h/ })).toBeDefined()
  await ui.unmount()
})
