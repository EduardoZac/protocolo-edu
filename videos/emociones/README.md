# emociones

Piezas de video vertical (1080x1920) sobre emociones, para Reels y TikTok de Filo.Blogía.

Cada carpeta es un proyecto HyperFrames independiente: `index.html` es la composición,
`vendor/gsap.min.js` el runtime local, y `renders/` la salida (fuera de git).

| Pieza        | Tema        | Duración | Estado                |
| ------------ | ----------- | -------- | --------------------- |
| `luz-propia` | Amor propio | 28.5s    | Renderizado, sin audio |

## Cómo trabajar una pieza

```bash
cd videos/emociones/<pieza>
npx hyperframes@0.8.33 check      # lint + layout + contraste, debe dar 0 errores
npx hyperframes@0.8.33 snapshot --at 3,12,25   # frames sueltos para revisar antes de rendear
npx hyperframes@0.8.33 render
```

Requisitos del entorno: Node 22+, `ffmpeg`, y Chrome Headless Shell
(`npx hyperframes browser ensure`). Detalle y gotchas en `.claude/skills/README.md`.

## Identidad (provisional)

Definida por mí, **no** tomada de la marca real — falta reemplazarla por los valores oficiales.

| Elemento     | Valor actual                             |
| ------------ | ---------------------------------------- |
| Fondo        | `#06070a`                                |
| Oro / acento | `#c9a227`, `#f2d27a`, `#e0b845`          |
| Texto        | `#f6f2e8`                                |
| Titulares    | Georgia (serif), la cursiva marca énfasis |
| Marca / UI   | Inter, mayúsculas, tracking amplio        |
| Wordmark     | `Filo.Blogía`                            |
| Cierre       | `eduardozacarias.com`                    |

## Regla de composición

El watermark va arriba (`#watermark`, top 150px) y el end card abajo (`#endcard`, top 1672px).
La zona entre 1180px y 1600px es donde vive el texto de cada beat — dejarla libre de marca.
