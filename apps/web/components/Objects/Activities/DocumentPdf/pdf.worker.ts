// El trabajador de pdf.js, como archivo propio para que el empaquetador lo
// sirva con `new Worker(new URL('./pdf.worker.ts', import.meta.url))`, la forma
// que entienden igual webpack y Turbopack. Al cargarse dentro del trabajador,
// pdf.js se engancha solo a sus mensajes; la asignación es para que el
// empaquetador no lo descarte por "no usado".
// @ts-expect-error pdf.js no trae tipos del trabajador
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'

;(self as any).pdfjsWorker = { WorkerMessageHandler }
