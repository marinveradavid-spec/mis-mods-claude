import { atom, read, update } from 'claude-code'
import type { Register, ToolCallInput } from 'claude-code'

import type { Leccion } from '../types'

const PANEL = 'aprendiz'
const lecciones = atom({ plugin: 'aprendiz', key: 'lecciones' } as const, [], { shape: 'lecciones-1' })
const pausado = atom({ plugin: 'aprendiz', key: 'pausado' } as const, false)
const pensando = atom({ plugin: 'aprendiz', key: 'pensando' } as const, false)

const PROFESOR = `Eres "Aprendiz", un profesor paciente que enseña a una persona sin conocimientos técnicos a sacar partido a Claude.
Te paso lo que la persona pidió y lo que Claude hizo para responder. Escribe UNA microlección en español:
- Primera línea: un título de máximo 6 palabras.
- Después, 2 o 3 frases cortas: qué hizo Claude y por qué, con palabras de todos los días. Si usas una palabra técnica, explícala con una comparación cotidiana.
- Termina con una línea que empiece por "Consejo:" con algo práctico para pedirle mejor las cosas a Claude o gastar menos.
Nada de listas largas ni código. Máximo 70 palabras en total.`

function archivo(v: unknown): string {
  return typeof v === 'string' ? (v.split('/').pop() ?? v) : ''
}

function resumir(e: ToolCallInput): string {
  const a = e as unknown as Record<string, unknown>
  const d = typeof a.description === 'string' ? a.description : ''
  switch (e.tool) {
    case 'Read': return `leyó el archivo ${archivo(a.file_path)}`
    case 'Write': return `creó el archivo ${archivo(a.file_path)}`
    case 'Edit': return `modificó el archivo ${archivo(a.file_path)}`
    case 'Bash': return `ejecutó una orden en el ordenador${d ? ` (${d})` : ''}`
    case 'Grep': case 'Glob': return 'buscó dentro de los archivos'
    case 'WebSearch': return 'buscó en internet'
    case 'WebFetch': return 'leyó una página web'
    case 'Agent': return `encargó una parte del trabajo a un ayudante${d ? ` (${d})` : ''}`
    case 'Skill': return 'cargó una habilidad especializada'
    default: return e.tool.startsWith('mcp__') ? `usó la conexión ${e.tool.split('__')[1] ?? ''}` : `usó la herramienta ${e.tool}`
  }
}

export const register: Register = on => {
  let pedido = ''
  let acciones: string[] = []

  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({ name: 'aprendiz', description: 'Abre la ventanita de microlecciones' })
    void $.ui.open({ id: PANEL, title: 'Aprendiz' })
    return ran
  })

  on('command.run', { command: 'aprendiz' }, async $ => {
    await $.ui.open({ id: PANEL, title: 'Aprendiz' })
    return { text: 'Aprendiz abierto.' }
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined && e.text) {
      pedido = e.text
      acciones = []
    }
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    if (e.agentId === undefined) {
      const r = resumir(e)
      if (acciones[acciones.length - 1] !== r) acciones.push(r)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer' || !pedido) return ran
    if (await read($, pausado)) return ran

    const hechos = acciones.length ? acciones.slice(0, 15).join('; ') : 'respondió directamente, sin usar herramientas'
    const loPedido = pedido.slice(0, 1500)
    pedido = ''
    await update($, pensando, () => true)
    const r = await $.model.complete({
      model: 'haiku',
      system: PROFESOR,
      prompt: `La persona pidió: """${loPedido}"""\nPara responder, Claude: ${hechos}.\nLa respuesta empezaba así: """${e.answer.slice(0, 400)}"""`,
      maxTokens: 220,
      effort: 'low',
      timeoutMs: 15000,
    })
    await update($, pensando, () => false)
    if (r.isAnswered && r.text.trim()) {
      const [titulo, ...resto] = r.text.trim().split('\n').filter(l => l.trim())
      const d = new Date(await $.clock.now())
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const nueva: Leccion = { hora, titulo: (titulo ?? 'Lección').replace(/^[#*\s]+|[*]+$/g, ''), texto: resto.join('\n') }
      await update($, lecciones, l => [nueva, ...l].slice(0, 30))
    }
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lista = await read($, lecciones)
    const enPausa = await read($, pausado)
    const ocupado = await read($, pensando)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>🎓 Tus microlecciones </Text>
          <Button key="pausa" label={enPausa ? 'Reanudar' : 'Pausar'} onPress={() => update($, pausado, v => !v)} />
          {lista.length > 0 && <Button key="borrar" label="Borrar" onPress={() => update($, lecciones, () => [])} />}
        </Box>
        {enPausa && <Text color="warning">En pausa: no se crean lecciones (y no gasta nada).</Text>}
        {ocupado && <Text dimColor>Preparando una lección sobre lo último que hizo Claude…</Text>}
        {lista.length === 0 && !ocupado && <Text dimColor>Cuando Claude termine de responderte, aquí aparecerá una lección corta sobre lo que hizo.</Text>}
        {lista.map((l, i) => (
          <Box key={'l' + i} flexDirection="column" borderStyle="round" paddingX={1}>
            <Text bold color={i === 0 ? 'claude' : 'text'}>{l.titulo} <Text dimColor>· {l.hora}</Text></Text>
            <Text>{l.texto}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
