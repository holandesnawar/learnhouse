'use client'
import React from 'react'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff, X } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useFormik } from 'formik'
import { resetPassword } from '@services/auth/auth'
import { useTranslation } from 'react-i18next'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import AuthShell from '@components/Auth/AuthShell'
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

const inputBase =
  'w-full px-4 py-3.5 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors'
const inputWithEye = `${inputBase} pr-11`

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
      try {
        const res = await resetPassword(
          values.email,
          values.new_password,
          org?.id,
          values.reset_code
        )
        if (res.status == 200) {
          setMessage(typeof res.data === 'string' ? res.data : t('auth.password_reset_success'))
        } else if (res.status === 0) {
          setError('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
        } else {
          const detail = res.data?.detail
          const msg =
            typeof detail === 'string'
              ? detail
              : detail && typeof detail.message === 'string'
                ? detail.message
                : typeof res.data === 'string' && res.data
                  ? res.data
                  : t('auth.error_generic')
          setError(msg)
        }
      } catch (e) {
        // Never leave the button stuck on "loading": surface a friendly error
        // if the request itself fails (network, non-JSON 5xx, etc.).
        setError(t('auth.error_generic'))
      } finally {
        setShowMessage(true)
        setIsSubmitting(false)
      }
    },
  })

  return (
    <AuthShell>
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

      <div className="relative z-0 w-full max-w-[420px] flex flex-col items-center gap-8">
        {/* Logo omitted: AuthShell navbar already shows it. */}
        <div className="w-full text-white/95">
          <h1
            className="text-center font-bold leading-[1.1]"
            style={{
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              fontSize: 'clamp(26px, 4vw, 36px)',
              letterSpacing: '-0.03em',
            }}
          >
            <span
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.45) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Cambia tu
            </span>{' '}
            <span style={{ color: '#4da3ff' }}>contraseña</span>
          </h1>
          <p className="text-center text-[15px] text-white/70 mt-2 mb-7">
            Elige una contraseña nueva y vuelve a entrar.
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
                    onChange={formik.handleChange}
                    value={formik.values.email}
                    className={inputBase}
                  />
                </Form.Control>
                {formik.touched.email && formik.errors.email && (
                  <p className="text-xs text-rose-300">{formik.errors.email as string}</p>
                )}
              </Form.Field>

              <Form.Field name="reset_code" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.reset_code')}
                </Form.Label>
                <Form.Control asChild>
                  <input
                    type="text"
                    onChange={formik.handleChange}
                    value={formik.values.reset_code}
                    className={inputBase}
                  />
                </Form.Control>
                {formik.touched.reset_code && formik.errors.reset_code && (
                  <p className="text-xs text-rose-300">{formik.errors.reset_code as string}</p>
                )}
              </Form.Field>

              <Form.Field name="new_password" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.new_password')}
                </Form.Label>
                <div className="relative">
                  <Form.Control asChild>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      onChange={formik.handleChange}
                      value={formik.values.new_password}
                      className={inputWithEye}
                    />
                  </Form.Control>
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#1D0084]/60 hover:text-[#1D0084] transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={formik.values.new_password} />
                {formik.touched.new_password && formik.errors.new_password && (
                  <p className="text-xs text-rose-300">{formik.errors.new_password as string}</p>
                )}
              </Form.Field>

              <Form.Field name="confirm_password" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.confirm_password')}
                </Form.Label>
                <div className="relative">
                  <Form.Control asChild>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      onChange={formik.handleChange}
                      value={formik.values.confirm_password}
                      className={inputWithEye}
                    />
                  </Form.Control>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#1D0084]/60 hover:text-[#1D0084] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formik.touched.confirm_password && formik.errors.confirm_password && (
                  <p className="text-xs text-rose-300">{formik.errors.confirm_password as string}</p>
                )}
              </Form.Field>

              <Form.Submit asChild>
                <button className="mt-2 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]">
                  {isSubmitting ? t('common.loading') : (
                    <>
                      {t('auth.change_password')}
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
    </AuthShell>
  )
}

export default ResetPasswordClient
