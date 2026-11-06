import { atom, read, update } from 'claude-code'
import type { Register, ToolCallInput, AgentStatus } from 'claude-code'

import type { Agente } from '../types'

const PANEL = 'mision'
const PRINCIPAL: Agente = { id: 'principal', tarea: 'Tu conversación', tipo: 'principal', modelo: '', estado: 'esperando', accion: '—', pasos: 0, inicio: 0 }

const principal = atom({ plugin: 'mission-control', key: 'principal' } as const, PRINCIPAL, { shape: 'agente-1' })
const ayudantes = atom({ plugin: 'mission-control', key: 'ayudantes' } as const, [], { shape: 'agentes-1' })

function corto(v: unknown, n = 50): string {
  const s = typeof v === 'string' ? v : ''
  const una = s.replace(/\s+/g, ' ').trim()
  return una.length > n ? una.slice(0, n - 1) + '…' : una
}

function archivo(v: unknown): string {
  return typeof v === 'string' ? (v.split('/').pop() ?? v) : ''
}

export function describir(e: ToolCallInput): string {
  const a = e as unknown as Record<string, unknown>
  switch (e.tool) {
    case 'Read': return `leyendo ${archivo(a.file_path)}`
    case 'Write': return `creando ${archivo(a.file_path)}`
    case 'Edit': return `modificando ${archivo(a.file_path)}`
    case 'Bash': return `ejecutando: ${corto(a.description ?? a.command)}`
    case 'Grep': return `buscando "${corto(a.pattern, 30)}"`
    case 'Glob': return `buscando archivos ${corto(a.pattern, 30)}`
    case 'WebSearch': return `buscando en internet: ${corto(a.query)}`
    case 'WebFetch': return 'leyendo una página web'
    case 'Agent': return `encargando a un ayudante: ${corto(a.description)}`
    case 'TaskCreate': case 'TaskUpdate': return 'actualizando su lista de tareas'
    default: return e.tool.startsWith('mcp__') ? `usando ${e.tool.split('__')[1] ?? 'una conexión'}` : `usando ${e.tool}`
  }
}

const ESTADO: Record<AgentStatus, string> = {
  pending: 'arrancando', running: 'trabajando', waiting: 'esperando permiso', idle: 'en pausa',
  completed: 'terminado', failed: 'falló', killed: 'detenido',
}

function hace(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({ name: 'mision', description: 'Abre el panel Mission Control (agentes y lo que hacen)' })
    void $.ui.open({ id: PANEL, title: 'Mission Control' })
    return ran
  })

  on('command.run', { command: 'mision' }, async $ => {
    await $.ui.open({ id: PANEL, title: 'Mission Control' })
    return { text: 'Mission Control abierto.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const ahora = await $.clock.now()
      const modelo = await $.session.model()
      await update($, principal, p => ({ ...p, estado: 'trabajando', accion: 'pensando…', pasos: 0, inicio: ahora, modelo }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) {
      await update($, principal, p => ({ ...p, estado: 'esperando tu mensaje', accion: e.isAborted ? 'lo paraste tú' : 'respuesta entregada' }))
    } else {
      const id = e.agentId
      await update($, ayudantes, l => l.map(a => (a.id === id ? { ...a, estado: e.isAborted ? 'detenido' : 'terminado', accion: 'entregó su informe' } : a)))
    }
    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.agentId) {
      const ahora = await $.clock.now()
      const nuevo: Agente = {
        id: ran.agentId, tarea: e.description || 'sin descripción', tipo: e.subagentType,
        modelo: ran.model, estado: 'trabajando', accion: 'empezando…', pasos: 0, inicio: ahora,
      }
      await update($, ayudantes, l => [...l.filter(a => a.id !== nuevo.id), nuevo].slice(-30))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const accion = describir(e)
    if (e.agentId === undefined) {
      await update($, principal, p => ({ ...p, accion, pasos: p.pasos + 1 }))
    } else {
      const id = e.agentId
      await update($, ayudantes, l => l.map(a => (a.id === id ? { ...a, accion, pasos: a.pasos + 1 } : a)))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = await read($, principal)
    const lista = await read($, ayudantes)
    const ahora = await $.clock.now()
    let vivos: Record<string, AgentStatus> = {}
    try {
      for (const a of await $.agent.list()) vivos[a.id] = a.status
    } catch {
      vivos = {}
    }
    const activos = lista.filter(a => (vivos[a.id] ? ESTADO[vivos[a.id]!] : a.estado) === 'trabajando').length

    return (
      <Box flexDirection="column">
        <Text bold>🧠 Agente principal</Text>
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Text color={p.estado === 'trabajando' ? 'success' : 'subtle'} bold>
            {p.estado === 'trabajando' ? '● trabajando' : '○ ' + p.estado}
            {p.modelo ? ` · ${p.modelo}` : ''}
          </Text>
          <Text>Ahora: {p.accion}</Text>
          {p.estado === 'trabajando' && <Text dimColor>{p.pasos} acciones · desde hace {hace(ahora - p.inicio)}</Text>}
        </Box>
        <Text bold>🤝 Ayudantes ({activos} trabajando, {lista.length} en total)</Text>
        {lista.length === 0 && <Text dimColor>Ninguno todavía. Aparecen cuando Claude reparte trabajo.</Text>}
        {[...lista].reverse().map(a => {
          const estado = vivos[a.id] ? ESTADO[vivos[a.id]!] : a.estado
          const trabajando = estado === 'trabajando'
          return (
            <Box key={a.id} flexDirection="column" borderStyle="round" paddingX={1}>
              <Text bold color={trabajando ? 'success' : estado === 'falló' ? 'error' : 'subtle'}>
                {trabajando ? '●' : '○'} {a.tarea}
              </Text>
              <Text dimColor>{a.tipo} · {a.modelo} · {estado}</Text>
              <Text>{trabajando ? 'Ahora: ' : 'Último: '}{a.accion}</Text>
              <Text dimColor>{a.pasos} acciones{trabajando ? ` · ${hace(ahora - a.inicio)}` : ''}</Text>
              {trabajando && <Button key={'ver-' + a.id} label="Ver qué hace" onPress={() => void $.ui.view({ agentId: a.id })} />}
            </Box>
          )
        })}
        {lista.length > 0 && <Button key="limpiar" label="Limpiar terminados" onPress={() => update($, ayudantes, l => l.filter(a => (vivos[a.id] ? ESTADO[vivos[a.id]!] : a.estado) === 'trabajando'))} />}
      </Box>
    )
  })
}
