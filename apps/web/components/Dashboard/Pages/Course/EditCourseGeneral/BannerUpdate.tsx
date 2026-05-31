import { useCourse } from '@components/Contexts/CourseContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { updateCourseBanner } from '@services/courses/courses'
import { getCourseBannerMediaDirectory } from '@services/media/media'
import { ArrowBigUpDash, UploadCloud } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@lib/query/keys'
import toast from 'react-hot-toast'
import { SafeImage } from '@components/Objects/SafeImage'

const MAX_FILE_SIZE = 8_000_000
const VALID_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const

type ValidImageMimeType = (typeof VALID_IMAGE_MIME_TYPES)[number]

function BannerUpdate() {
  const inputRef = useRef<HTMLInputElement>(null)
  const course = useCourse() as any
  const session = useLHSession() as any
  const org = useOrg() as any
  const queryClient = useQueryClient()
  const [localPreview, setLocalPreview] = useState<{ file: File; url: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (localPreview?.url) URL.revokeObjectURL(localPreview.url)
    }
  }, [localPreview])

  const showError = (msg: string) =>
    toast.error(msg, { duration: 3000, position: 'top-center' })

  const validate = (file: File): boolean => {
    if (!VALID_IMAGE_MIME_TYPES.includes(file.type as ValidImageMimeType)) {
      showError(`Formato no válido: ${file.type}. Sube PNG o JPG.`)
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      showError(`El archivo (${(file.size / 1024 / 1024).toFixed(2)}MB) supera el límite de 8MB.`)
      return false
    }
    return true
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      showError('Selecciona un archivo')
      return
    }
    if (!validate(file)) {
      e.target.value = ''
      return
    }
    const blobUrl = URL.createObjectURL(file)
    setLocalPreview({ file, url: blobUrl })
    await upload(file)
  }

  const upload = async (file: File) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('banner', file)
      const res = await updateCourseBanner(
        course.courseStructure.course_uuid,
        formData,
        session.data?.tokens?.access_token,
      )
      const cleanUuid = course.courseStructure.course_uuid.replace('course_', '')
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.meta(cleanUuid) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.courses.list(org.slug) })
      await new Promise((r) => setTimeout(r, 1200))
      if (res.success === false) {
        showError(res.HTTPmessage)
      } else {
        setLocalPreview(null)
        toast.success('Banner actualizado', { duration: 3000, position: 'top-center' })
      }
    } catch {
      showError('No se pudo subir el banner')
    } finally {
      setIsLoading(false)
    }
  }

  const currentBannerFile =
    course?.courseStructure?.extra_metadata?.banner_image as string | undefined
  const currentBannerUrl = currentBannerFile
    ? getCourseBannerMediaDirectory(
        org?.org_uuid,
        course.courseStructure.course_uuid,
        currentBannerFile,
      )
    : null

  const previewUrl = localPreview?.url ?? currentBannerUrl

  return (
    <div className="w-full bg-white rounded-xl">
      <div className="p-6 space-y-4">
        {previewUrl ? (
          <div className="max-w-[640px] mx-auto">
            <SafeImage
              src={previewUrl}
              alt="Vista previa del banner"
              className={`${
                isLoading ? 'animate-pulse' : ''
              } w-full aspect-[21/9] object-cover rounded-lg border border-gray-200`}
            />
          </div>
        ) : (
          <div className="max-w-[640px] mx-auto aspect-[21/9] flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 text-sm">
            Sin banner — se mostrará el thumbnail como cabecera
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center mt-2">
            <div className="font-medium text-sm text-green-800 bg-green-50 rounded-full px-4 py-2 flex items-center">
              <ArrowBigUpDash size={16} className="mr-2 animate-bounce" />
              Subiendo…
            </div>
          </div>
        ) : (
          <div className="flex justify-center gap-2 mt-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4da3ff]"
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud size={16} />
              Subir banner
            </button>
          </div>
        )}

        <p className="text-xs text-gray-500 text-center">
          Formato recomendado <strong>21:9</strong> (p. ej. 1920×823). PNG o JPG, máx. 8MB.
          Se muestra como cabecera al entrar al curso.
        </p>
      </div>
    </div>
  )
}

export default BannerUpdate
