import { expect, test } from 'claude-code/testing'

const PANE = { plugin: 'aprendiz', component: 'Pane', requestId: 'aprendiz',
  props: { title: 'Aprendiz', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } } as const

test('crea una lección al terminar una respuesta', async ($, on) => {
  on('command.register', () => ({ value: { command: 'aprendiz' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: 'Claude leyó tu archivo\nPrimero miró el archivo.\nConsejo: di el nombre del archivo.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'resume notas.md', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/x/notas.md' })
  await $.turn.complete({ answer: 'Resumen…', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Claude leyó tu archivo/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Consejo:/ })).toBeDefined()
  await ui.unmount()
})
