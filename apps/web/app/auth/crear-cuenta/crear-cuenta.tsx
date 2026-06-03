'use client'
import React from 'react'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, ArrowRight, CheckCircle, Eye, EyeOff, X } from 'lucide-react'
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
  } else if (!validatePasswordStrength(values.new_password).isValid) {
    errors.new_password = t('auth.password_requirements_not_met')
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

interface CrearCuentaClientProps {
  org: any
}

const inputBase =
  'w-full px-4 py-3.5 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors'
const inputWithEye = `${inputBase} pr-11`

function CrearCuentaClient({ org }: CrearCuentaClientProps) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const reset_code = searchParams.get('resetCode') || ''
  const email = searchParams.get('email') || ''

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [showMessage, setShowMessage] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      email,
      new_password: '',
      confirm_password: '',
      reset_code,
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
        setMessage('Cuenta creada. Ya puedes entrar a la academia.')
        setShowMessage(true)
        setIsSubmitting(false)
      } else {
        setError(res.data?.detail ?? t('auth.error_generic'))
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
                    Entrar
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
              Crea tu
            </span>{' '}
            <span style={{ color: '#4da3ff' }}>cuenta</span>
          </h1>
          <p className="text-center text-[15px] text-white/70 mt-2 mb-7">
            Pon una contraseña para entrar a la academia.
          </p>

          <FormLayout onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-4 text-left">
              {/* Email — pre-llenado y solo lectura porque viene del email de bienvenida */}
              <Form.Field name="email" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.email')}
                </Form.Label>
                <Form.Control asChild>
                  <input
                    type="email"
                    value={formik.values.email}
                    readOnly
                    className={`${inputBase} cursor-not-allowed opacity-90`}
                  />
                </Form.Control>
              </Form.Field>

              {/* Hidden reset_code — viene de la URL, no la mostramos */}
              <input type="hidden" name="reset_code" value={formik.values.reset_code} />

              <Form.Field name="new_password" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  Contraseña
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
                  Confirmar contraseña
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
                      Crear cuenta y entrar
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
          className="text-[13px] text-white/55 hover:text-white/90 transition-colors"
        >
          Ya tengo cuenta — Entrar
        </Link>
      </div>
    </AuthShell>
  )
}

export default CrearCuentaClient
