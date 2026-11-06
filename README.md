# Mis mods para Claude Code

Cuatro mods para Claude Code:

| Mod | Qué hace |
| --- | --- |
| **medidor** | Franja encima del cuadro de texto con el % gastado del límite de 5 horas y del semanal, cuánto falta para que se reinicien, y lo llena que está la conversación, con un consejo de cuándo abrir una nueva. |
| **asesor-modelo** | Al enviar un mensaje, te dice si para esa tarea conviene Haiku, Sonnet u Opus y si estás usando uno más caro de lo necesario. Hace una consulta pequeña a Haiku por mensaje. |
| **mission-control** | Panel lateral con el agente principal y los ayudantes, qué hace cada uno ahora y cuántas acciones lleva. Se reabre con `/mision`. |
| **aprendiz** | Panel lateral con una microlección sencilla tras cada respuesta de Claude. Se reabre con `/aprendiz`. Hace una consulta pequeña a Haiku por respuesta (se puede pausar). |

## Instalar

Desde la ventana de Claude Code, uno por uno:

```
/plugin install medidor --marketplace marinveradavid-spec/mis-mods-claude
/plugin install asesor-modelo --marketplace marinveradavid-spec/mis-mods-claude
/plugin install mission-control --marketplace marinveradavid-spec/mis-mods-claude
/plugin install aprendiz --marketplace marinveradavid-spec/mis-mods-claude
```

Desde la terminal:

```
claude plugin install medidor --marketplace marinveradavid-spec/mis-mods-claude
```

En la app de escritorio: botón **+** junto al cuadro de texto → **Plugins** → **Add marketplace** con `marinveradavid-spec/mis-mods-claude` → **Add plugin**.

Este repositorio es privado: para instalar, el ordenador tiene que tener acceso a GitHub con tu cuenta.
