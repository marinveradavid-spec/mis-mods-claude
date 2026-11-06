import { expect, test } from 'claude-code/testing'

const BAND = { plugin: 'asesor-modelo', component: 'AbovePrompt', props: { hasSurvey: false } } as const

test('recomienda Haiku si usas Opus para algo sencillo', async ($, on) => {
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'HAIKU | es una pregunta corta', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }))
  await $.prompt.submit({ text: '¿cómo se dice gato en inglés?' })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^Haiku$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\/model haiku/ })).toBeDefined()
    await ui.unmount()
  }
})

test('deja sitio a lo que dibujan otros mods en la misma franja', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>otro mod</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /otro mod/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Asesor de modelo/ })).toBeDefined()
  await ui.unmount()
})
