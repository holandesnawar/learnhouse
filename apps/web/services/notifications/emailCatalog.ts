'use client'
import { getAPIUrl } from '@services/config/config'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'

/**
 * Catálogo de los correos automáticos de la escuela.
 *
 * Sirve para verlos desde el panel: cuáles existen, cuándo salen y qué aspecto
 * tienen exactamente. Ver o enviarse uno a uno mismo no afecta a los alumnos:
 * los automáticos siguen saliendo igual cuando toca.
 */

export type EmailTemplate = {
  id: string
  name: string
  when: string
}

export async function listEmailTemplates(
  accessToken: string | undefined
): Promise<EmailTemplate[]> {
  if (!accessToken) return []
  try {
    const r = await fetch(
      `${getAPIUrl()}superadmin/email-templates`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return []
    return await r.json()
  } catch {
    return []
  }
}

export async function previewEmailTemplate(
  templateId: string,
  accessToken: string | undefined
): Promise<{ subject: string; html: string } | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}superadmin/email-templates/${templateId}/preview`,
      RequestBodyWithAuthHeader('GET', null, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export async function sendEmailTemplateTest(
  templateId: string,
  accessToken: string | undefined
): Promise<{ sent_to: string } | null> {
  if (!accessToken) return null
  try {
    const r = await fetch(
      `${getAPIUrl()}superadmin/email-templates/${templateId}/send-test`,
      RequestBodyWithAuthHeader('POST', {}, null, accessToken)
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
