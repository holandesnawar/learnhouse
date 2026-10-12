import { useOrg } from '@components/Contexts/OrgContext'
import { getActivityMediaDirectory } from '@services/media/media'
import { Download } from 'lucide-react'
import React from 'react'

/** "Cuaderno de repaso · Módulo 1" → "Cuaderno de repaso - Módulo 1.pdf". */
function nombreDeArchivo(nombre: string | undefined): string {
  const limpio = (nombre || 'documento')
    .replace(/[\\/:*?"<>|·]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return /\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`
}

function DocumentPdfActivity({
  activity,
  course,
  orgUuid,
  className,
}: {
  activity: any
  course: any
  orgUuid?: string
  className?: string
}) {
  const org = useOrg() as any
  const resolvedOrgUuid = orgUuid || org?.org_uuid
  const url = getActivityMediaDirectory(
    resolvedOrgUuid,
    course?.course_uuid,
    activity.activity_uuid,
    activity.content.filename,
    'documentpdf'
  )

  // Incrustado en otra pantalla (los tableros): solo el visor, como siempre.
  if (className) {
    return (
      <div className={className}>
        <iframe className="w-full h-full" src={url} />
      </div>
    )
  }

  return (
    <div className="m-0 sm:m-8 mt-0 sm:mt-14">
      {/* El visor de dentro de la página no sirve para llevárselo: en el
          iPhone solo enseña la primera página y no deja descargar nada. Los
          cuadernos de repaso son para imprimir (pedido de una alumna,
          12/10/2026), así que el botón va arriba y a la vista. Abre en otra
          pestaña además de descargar: en los navegadores que ignoran
          `download` (el de Instagram, alguno de Android) se ve el PDF entero
          y desde ahí se guarda o se imprime. */}
      {url ? (
        <div className="mb-3 sm:mb-4 mx-3 sm:mx-0 mt-3 sm:mt-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE6F5] bg-[#F0F5FF] px-4 py-3">
          <p className="text-[13.5px] text-[#0a1656] leading-snug">
            ¿Lo quieres en papel? Descárgalo para imprimirlo o guardarlo en el móvil.
          </p>
          <a
            href={url}
            download={nombreDeArchivo(activity?.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#4da3ff] hover:bg-[#5eb4ff] px-4 py-2.5 text-[14px] font-semibold text-[#0a1656] transition-colors"
          >
            <Download size={16} strokeWidth={2.4} />
            Descargar para imprimir
          </a>
        </div>
      ) : null}
      <div className="bg-zinc-900 sm:rounded-md">
        <iframe className="sm:rounded-lg w-full h-[85vh] sm:h-[900px]" src={url} />
      </div>
    </div>
  )
}

export default DocumentPdfActivity
