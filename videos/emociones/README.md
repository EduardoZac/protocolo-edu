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

## Identidad

Lo único documentado en las skills de FiloBlogía es la dirección de arte de las imágenes
destacadas: `Estilo: editorial oscuro, filosófico` (`filoblogia-article-writer/SKILL.md:111`).
Sobre eso construí la paleta. Los valores exactos son míos, **no** oficiales — falta
reemplazarlos cuando llegue el manual de marca.

| Elemento     | Valor actual                             |
| ------------ | ---------------------------------------- |
| Fondo        | `#06070a`                                |
| Oro / acento | `#c9a227`, `#f2d27a`, `#e0b845`          |
| Texto        | `#f6f2e8`                                |
| Titulares    | Georgia (serif), la cursiva marca énfasis |
| Marca / UI   | Inter, mayúsculas, tracking amplio        |
| Wordmark     | `Filo.Blogía`                            |
| Cierre       | `eduardozacarias.com`                    |

## Reglas editoriales que aplican al video

Vienen de `filoblogia-article-writer/SKILL.md` y `filoblogia-tiktok-writer/SKILL.md`.
Son la parte de la marca que sí está escrita, y mandan sobre el copy de cada pieza:

- **El cierre es una pregunta, nunca una resolución.** "Termina con una pregunta directa
  al lector — breve, incómoda, memorable. Esta pregunta debe poder funcionar como gancho
  de redes sociales por sí sola."
- Prohibidas las frases motivacionales vacías y las conclusiones morales explícitas.
- Frases cortas. Una sola idea central por pieza. No dos.
- Debe existir un giro que reencuadre la lectura convencional del tema.
- Los primeros 3 segundos son el hook: sin presentación, sin contexto previo.

## Regla de composición

El watermark va arriba (`#watermark`, top 150px) y el end card abajo (`#endcard`, top 1672px).
La zona entre 1180px y 1600px es donde vive el texto de cada beat — dejarla libre de marca.
