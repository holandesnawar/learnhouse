'use client'
import React from 'react'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useFormik } from 'formik'
import { sendResetLink } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import AuthChrome from '../AuthChrome'

const validate = (values: any, t: any) => {
  const errors: any = {}
  if (!values.email) {
    errors.email = t('validation.required')
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = t('validation.invalid_email')
  }
  return errors
}

interface ForgotPasswordClientProps {
  org: any
}

// Matches the visual language of nawar-web/src/pages/acceso.astro:
// dark Nawar gradient, logo on top, Poppins title with a soft white→translucent
// gradient + #4da3ff accent, and #F0F5FF inputs with brand-blue text.
const inputClass =
  'w-full px-4 py-3.5 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors'

function ForgotPasswordClient({ org }: ForgotPasswordClientProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [showMessage, setShowMessage] = React.useState(false)

  const formik = useFormik({
    initialValues: { email: '' },
    validate: (values) => validate(values, t),
    validateOnBlur: true,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      setError('')
      setMessage('')
      setShowMessage(false)
      const res = await sendResetLink(values.email, org?.id)
      if (res.status == 200) {
        setMessage(res.data + ', ' + t('auth.check_email_message'))
        setShowMessage(true)
        setIsSubmitting(false)
      } else {
        setError(res.data.detail)
        setShowMessage(true)
        setIsSubmitting(false)
      }
    },
  })

  return (
    <AuthChrome>
      {/* Message Top Bar */}
      {showMessage && (error || message) && (
        <div
          className={`
            absolute top-0 inset-x-0 z-10 w-full px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200
            ${error ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}
          `}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {error ? (
              <AlertTriangle size={18} className="shrink-0" />
            ) : (
              <CheckCircle size={18} className="shrink-0" />
            )}
            <span className="text-sm font-medium">{error || message}</span>
          </div>
          <button
            onClick={() => setShowMessage(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="relative z-0 w-full max-w-[420px] flex flex-col items-center gap-8">
        <div className="w-full text-white/95">
          <h1
            className="text-center font-bold leading-[1.2]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(22px, 3.2vw, 27px)',
              letterSpacing: '-0.02em',
              background:
                'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.72) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ¿Olvidaste tu contraseña?
          </h1>
          <p className="text-center text-[15px] text-white/70 mt-2 mb-7">
            Dinos tu correo y te enviamos un enlace para recuperarla.
          </p>

          <FormLayout onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-4 text-left">
              <Form.Field name="email" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.email')}
                </Form.Label>
                <Form.Control asChild>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.email}
                    autoComplete="email"
                    required
                    className={inputClass}
                  />
                </Form.Control>
                {formik.touched.email && formik.errors.email && (
                  <p className="text-xs text-rose-300">
                    {formik.errors.email as string}
                  </p>
                )}
              </Form.Field>

              <Form.Submit asChild>
                <button className="mt-2 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]">
                  {isSubmitting ? t('common.loading') : (
                    <>
                      {t('auth.send_reset_link')}
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </Form.Submit>
            </div>
          </FormLayout>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-[13px] text-white/55 hover:text-white/90 transition-colors"
        >
          <ArrowLeft size={14} />
          {t('auth.back_to_login')}
        </Link>
      </div>
    </AuthChrome>
  )
}

export default ForgotPasswordClient
