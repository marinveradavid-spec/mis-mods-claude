import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Consejo } from '../types'

const consejo = atom({ plugin: 'asesor-modelo', key: 'consejo' } as const, null, { shape: 'consejo-1' })
const oculto = atom({ plugin: 'asesor-modelo', key: 'oculto' } as const, false)

const SISTEMA = `Decides qué modelo de Claude conviene para una petición, para no gastar de más.
- HAIKU: preguntas rápidas, dudas sencillas, traducir, corregir ortografía, resumir algo corto, formatear, renombrar, buscar algo concreto.
- SONNET: la mayoría del trabajo normal: escribir o revisar código habitual, redactar textos o correos, analizar un documento, arreglar errores corrientes.
- OPUS: tareas difíciles o largas: diseñar un sistema o la estructura de un proyecto, errores muy difíciles, planes de muchos pasos, razonamiento delicado, decisiones con mucho en juego.
Ante la duda, elige el más barato que lo haga bien.
Responde SOLO con una línea: MODELO | motivo en español, sin tecnicismos, de máximo 12 palabras.
Ejemplo: HAIKU | es una pregunta corta que no necesita pensar mucho`

const nombre = (id: string): string =>
  /haiku/i.test(id) ? 'Haiku' : /sonnet/i.test(id) ? 'Sonnet' : /opus/i.test(id) ? 'Opus' : /fable/i.test(id) ? 'Fable' : id

const COSTE: Record<string, number> = { Haiku: 1, Sonnet: 3, Opus: 5, Fable: 5 }

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || e.text.trim().length < 3) return next(e)
    if (await read($, oculto)) return next(e)

    const r = await $.model.complete({
      model: 'haiku',
      system: SISTEMA,
      prompt: `Petición:\n"""${e.text.slice(0, 3000)}"""`,
      maxTokens: 60,
      effort: 'low',
      timeoutMs: 6000,
    })
    if (r.isAnswered) {
      const m = /(HAIKU|SONNET|OPUS)\s*\|?\s*(.*)/i.exec(r.text)
      if (m && m[1]) {
        const ideal = (m[1][0]!.toUpperCase() + m[1].slice(1).toLowerCase()) as Consejo['ideal']
        const actual = nombre(await $.session.model())
        await update($, consejo, () => ({ ideal, motivo: (m[2] ?? '').trim(), actual }))
      }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, consejo)
    const { Box, Text, Button } = $.ui.resolve(e)

    if (await read($, oculto)) {
      return (
        <Box>
          <Text dimColor>Asesor de modelo en pausa </Text>
          <Button key="ver" label="Activar" onPress={() => update($, oculto, () => false)} />
        </Box>
      )
    }
    if (c === null) {
      return (
        <Box>
          <Text dimColor>Asesor de modelo: escribe algo y te diré qué modelo conviene</Text>
        </Box>
      )
    }

    const coincide = c.ideal === c.actual
    const caro = (COSTE[c.actual] ?? 0) > (COSTE[c.ideal] ?? 0)
    const estado = coincide
      ? '✓ ya lo estás usando'
      : caro
        ? `estás usando ${c.actual}: gastas más de lo necesario → escribe /model ${c.ideal.toLowerCase()}`
        : `estás usando ${c.actual}: puede quedarse corto → escribe /model ${c.ideal.toLowerCase()}`

    return (
      <Box>
        <Text bold>Modelo ideal: </Text>
        <Text color={coincide ? 'success' : 'warning'} bold>{c.ideal}</Text>
        <Text dimColor> ({c.motivo}) </Text>
        <Text color={coincide ? 'success' : 'warning'}>{estado} </Text>
        <Button key="ocultar" label="Pausar" onPress={() => update($, oculto, () => true)} />
      </Box>
    )
  })
}
