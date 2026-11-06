export type Agente = {
  id: string
  tarea: string
  tipo: string
  modelo: string
  estado: string
  accion: string
  pasos: number
  inicio: number
}

declare module 'claude-code' {
  interface PluginState {
    'mission-control': {
      principal: Shaped<Agente>
      ayudantes: Shaped<Agente[]>
    }
  }
}
