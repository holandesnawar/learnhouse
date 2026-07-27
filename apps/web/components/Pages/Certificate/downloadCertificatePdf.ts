import { CERT_H, CERT_W } from './NawarCertificateArt'

/**
 * Descarga el certificado como PDF capturando EL MISMO nodo que se ve en
 * pantalla. Antes cada pantalla reconstruía el certificado en HTML aparte, así
 * que la vista previa y el PDF descargado eran dos diseños distintos y había
 * que mantener tres copias.
 *
 * El nodo se clona sin la escala de pantalla para capturarlo a tamaño real.
 */
export async function downloadCertificatePdf(
  node: HTMLElement | null,
  fileName = 'Certificado-Holandes-Nawar.pdf'
): Promise<void> {
  if (!node) throw new Error('Certificate node not available')

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${CERT_W}px;height:${CERT_H}px;background:#ffffff;z-index:-1;`

  const clone = node.cloneNode(true) as HTMLElement
  clone.style.transform = 'none'
  clone.style.width = `${CERT_W}px`
  clone.style.height = `${CERT_H}px`
  holder.appendChild(clone)
  document.body.appendChild(holder)

  try {
    const canvas = await html2canvas(clone, {
      width: CERT_W,
      height: CERT_H,
      scale: 2, // 2x = nítido al imprimir
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const pdf = new jsPDF('landscape', 'mm', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    // Encajar el lienzo dentro de la página respetando la proporción.
    const ratio = Math.min(pageW / CERT_W, pageH / CERT_H)
    const w = CERT_W * ratio
    const h = CERT_H * ratio

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      (pageW - w) / 2,
      (pageH - h) / 2,
      w,
      h
    )
    pdf.save(fileName)
  } finally {
    holder.remove()
  }
}

/** Nombre de archivo legible a partir del título de la formación. */
export function certificateFileName(certificationName?: string): string {
  const base = (certificationName || 'Certificado')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base}-Holandes-Nawar.pdf`
}
