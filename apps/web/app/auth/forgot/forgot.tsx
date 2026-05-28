'use client'
import React from 'react'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, ArrowLeft, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { useFormik } from 'formik'
import { sendResetLink } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import { getOrgLogoMediaDirectory } from '@services/media/media'

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
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12"
      style={{
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
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

      <div className="relative z-0 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          {org?.logo_image ? (
            <img
              src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
              alt={org?.name}
              className="h-12 object-contain"
            />
          ) : (
            <span className="text-2xl font-bold text-white">{org?.name}</span>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white">
          {t('auth.forgot_password_title')}
        </h1>
        <p className="text-white/70 mt-1.5 mb-8">
          {t('auth.forgot_password_description')}
        </p>

        {/* Form */}
        <FormLayout onSubmit={formik.handleSubmit}>
          <div className="space-y-4 text-left">
            <Form.Field name="email" className="space-y-1.5">
              <Form.Label className="block text-sm font-semibold text-white">
                {t('auth.email')}
              </Form.Label>
              <Form.Control asChild>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.email}
                  required
                  className="w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#4da3ff]/60"
                />
              </Form.Control>
              {formik.touched.email && formik.errors.email && (
                <p className="text-xs text-rose-300">
                  {formik.errors.email as string}
                </p>
              )}
            </Form.Field>

            <Form.Submit asChild>
              <button className="w-full bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                {isSubmitting ? t('common.loading') : t('auth.send_reset_link')}
              </button>
            </Form.Submit>
          </div>
        </FormLayout>

        {/* Back to Login */}
        <p className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            {t('auth.back_to_login')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPasswordClient
