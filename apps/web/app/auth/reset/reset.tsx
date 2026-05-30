'use client'
import React from 'react'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, EyeOff, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useFormik } from 'formik'
import { resetPassword } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import {
  PasswordStrengthIndicator,
  validatePasswordStrength,
} from '@components/Auth/PasswordStrengthIndicator'

const validate = (values: any, t: any) => {
  const errors: any = {}

  if (!values.email) {
    errors.email = t('validation.required')
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = t('validation.invalid_email')
  }

  if (!values.new_password) {
    errors.new_password = t('validation.required')
  } else {
    const passwordValidation = validatePasswordStrength(values.new_password)
    if (!passwordValidation.isValid) {
      errors.new_password = t('auth.password_requirements_not_met')
    }
  }

  if (!values.confirm_password) {
    errors.confirm_password = t('validation.required')
  }

  if (values.new_password !== values.confirm_password) {
    errors.confirm_password = t('auth.passwords_do_not_match')
  }

  if (!values.reset_code) {
    errors.reset_code = t('validation.required')
  }
  return errors
}

interface ResetPasswordClientProps {
  org: any
}

function ResetPasswordClient({ org }: ResetPasswordClientProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const searchParams = useSearchParams()
  const reset_code = searchParams.get('resetCode') || ''
  const email = searchParams.get('email') || ''
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [showMessage, setShowMessage] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      email: email,
      new_password: '',
      confirm_password: '',
      reset_code: reset_code,
    },
    validate: (values) => validate(values, t),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      setError('')
      setMessage('')
      setShowMessage(false)
      const res = await resetPassword(
        values.email,
        values.new_password,
        org?.id,
        values.reset_code
      )
      if (res.status == 200) {
        setMessage(res.data)
        setShowMessage(true)
        setIsSubmitting(false)
      } else {
        setError(res.data?.detail ?? t('auth.error_generic'))
        setShowMessage(true)
        setIsSubmitting(false)
      }
    },
  })

  const fieldInputClass =
    'w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#4da3ff]/60'

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 sm:px-4 sm:py-12"
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
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{error || message}</span>
              {message && (
                <span className="text-sm ml-2">
                  ·{' '}
                  <Link href="/login" className="underline hover:no-underline">
                    {t('auth.proceed_to_login')}
                  </Link>
                </span>
              )}
            </div>
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
          {t('auth.reset_password_title')}
        </h1>
        <p className="text-white/70 mt-1.5 mb-8">
          {t('auth.reset_password_description')}
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
                  onChange={formik.handleChange}
                  value={formik.values.email}
                  className={fieldInputClass}
                />
              </Form.Control>
              {formik.touched.email && formik.errors.email && (
                <p className="text-xs text-rose-300">{formik.errors.email as string}</p>
              )}
            </Form.Field>

            <Form.Field name="reset_code" className="space-y-1.5">
              <Form.Label className="block text-sm font-semibold text-white">
                {t('auth.reset_code')}
              </Form.Label>
              <Form.Control asChild>
                <input
                  type="text"
                  onChange={formik.handleChange}
                  value={formik.values.reset_code}
                  className={fieldInputClass}
                />
              </Form.Control>
              {formik.touched.reset_code && formik.errors.reset_code && (
                <p className="text-xs text-rose-300">{formik.errors.reset_code as string}</p>
              )}
            </Form.Field>

            <Form.Field name="new_password" className="space-y-1.5">
              <Form.Label className="block text-sm font-semibold text-white">
                {t('auth.new_password')}
              </Form.Label>
              <div className="relative">
                <Form.Control asChild>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    onChange={formik.handleChange}
                    value={formik.values.new_password}
                    className={`${fieldInputClass} pr-11`}
                  />
                </Form.Control>
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <PasswordStrengthIndicator password={formik.values.new_password} />
              {formik.touched.new_password && formik.errors.new_password && (
                <p className="text-xs text-rose-300">{formik.errors.new_password as string}</p>
              )}
            </Form.Field>

            <Form.Field name="confirm_password" className="space-y-1.5">
              <Form.Label className="block text-sm font-semibold text-white">
                {t('auth.confirm_password')}
              </Form.Label>
              <div className="relative">
                <Form.Control asChild>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    onChange={formik.handleChange}
                    value={formik.values.confirm_password}
                    className={`${fieldInputClass} pr-11`}
                  />
                </Form.Control>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formik.touched.confirm_password && formik.errors.confirm_password && (
                <p className="text-xs text-rose-300">{formik.errors.confirm_password as string}</p>
              )}
            </Form.Field>

            <Form.Submit asChild>
              <button className="w-full bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#0a1656] font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                {isSubmitting ? t('common.loading') : t('auth.change_password')}
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

export default ResetPasswordClient
