export type Leccion = { hora: string; titulo: string; texto: string }

declare module 'claude-code' {
  interface PluginState {
    aprendiz: {
      lecciones: Shaped<Leccion[]>
      pausado: boolean
      pensando: boolean
    }
  }
}
