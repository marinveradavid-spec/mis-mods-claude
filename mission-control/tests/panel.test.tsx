import { expect, test } from 'claude-code/testing'

const PANE = { plugin: 'mission-control', component: 'Pane', requestId: 'mision',
  props: { title: 'Mission Control', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } } as const

test('muestra lo que hace el principal y un ayudante', async ($, on) => {
  on('command.register', () => ({ value: { command: 'mision' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Revisar textos', type: 'Explore', status: 'running' }] }))
  on('tool.call', () => ({ result: {} }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hola', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'Listar archivos' })
  await $.agent.spawn({ prompt: 'x', description: 'Revisar textos', subagentType: 'Explore' })
  await $.tool.call({ tool: 'Read', file_path: '/a/b/notas.md', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Listar archivos/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /leyendo notas\.md/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 trabajando/ })).toBeDefined()
    await ui.unmount()
  }
})
