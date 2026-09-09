# HyperFrames — skills de animación/video

26 skills de [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) (Apache 2.0). Renderizan MP4 desde HTML + GSAP, con timeline seekable y render determinista.

Reinstalar / actualizar:

```bash
npx skills add heygen-com/hyperframes -s '*' -a claude-code -y --copy
```

Entrada: la skill `hyperframes` es el router. Desde ahí se rutean `hyperframes-core` (contrato de composición), `hyperframes-animation`, `hyperframes-keyframes`, `media-use`, `hyperframes-cli`.

## Requisitos de render local

- Node 22+
- FFmpeg — `apt-get install -y ffmpeg`
- Chrome Headless Shell — `npx hyperframes browser ensure`
- Verificar todo: `npx hyperframes doctor`

## Gotchas verificados en este entorno

- **GSAP debe ser local.** El Chrome del render no pasa por el proxy de salida, así que `<script src="https://cdn.jsdelivr.net/...">` falla con `net::ERR_TUNNEL_CONNECTION_FAILED` → `sub_timeline_script_failure` y el render se aborta. Vendorizar:
  ```bash
  npm pack gsap@3.14.2 && tar -xzf gsap-3.14.2.tgz package/dist/gsap.min.js --strip-components=2 && mkdir -p vendor && mv gsap.min.js vendor/
  ```
  y referenciar `./vendor/gsap.min.js`.
- **Correr `npx hyperframes check` antes de `render`.** El lint atrapa bugs de seek reales (ej. `gsap_exit_missing_hard_kill`: un fade de salida sin `tl.set(..., { autoAlpha: 0 })` en el borde del clip deja estado visual pegado al saltar en la timeline).
- Sin `<br>` en texto de cuerpo; sin `crossorigin` en `<video>`/`<audio>`; cada `<audio>` necesita `id` o el render sale mudo.
- Un error de lint apaga las auditorías de layout y contraste — reportan `0 sample(s)` y parecen limpias sin haber corrido.

## Referencia de rendimiento (reel 9:16)

1080x1920, 30fps, 6s → 180 frames, 405 KB, **15.9s de render** con 4 cores / 2 workers.
