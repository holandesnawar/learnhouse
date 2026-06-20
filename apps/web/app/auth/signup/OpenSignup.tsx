'use client'
import { useFormik } from 'formik'
import React from 'react'
import * as Form from '@radix-ui/react-form'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import { AlertTriangle, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signup } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'
import { useTranslation } from 'react-i18next'
import { PasswordStrengthIndicator, validatePasswordStrength } from '@components/Auth/PasswordStrengthIndicator'

const inputClass =
  'w-full px-4 py-3.5 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors'
const labelClass = 'text-[13px] font-semibold text-white/90 tracking-[0.01em]'

const validate = (values: any, t: any) => {
  const errors: any = {}
  if (!values.email) errors.email = t('validation.required')
  else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) errors.email = t('validation.invalid_email')
  if (!values.password) errors.password = t('validation.required')
  else if (!validatePasswordStrength(values.password).isValid) errors.password = t('auth.password_requirements_not_met')
  if (!values.username) errors.username = t('validation.required')
  else if (values.username.length < 4) errors.username = t('validation.username_min_length')
  return errors
}

function OpenSignUpComponent() {
  const { t } = useTranslation()
  const org = useOrg() as any
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') || ''
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)

  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: emailParam,
      password: '',
      username: '',
      bio: '',
      first_name: '',
      last_name: '',
    },
    validate: (values) => validate(values, t),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError('')
      setMessage('')
      setIsSubmitting(true)
      try {
        const res = await signup(values)
        const data = await res.json().catch(() => ({}))
        if (res.status === 200) {
          setMessage(t('auth.account_created_success'))
        } else if ([400, 401, 404, 409].includes(res.status)) {
          setError(typeof data?.detail === 'string' ? data.detail : t('common.something_went_wrong'))
        } else {
          setError(t('common.something_went_wrong'))
        }
      } catch {
        setError('No se pudo conectar. Inténtalo de nuevo.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <div className="relative z-0 w-full max-w-[440px] flex flex-col items-center gap-7">
      <div className="w-full text-white/95">
        <h1
          className="text-center font-bold leading-[1.1]"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif', fontSize: 'clamp(26px, 4vw, 34px)', letterSpacing: '-0.03em' }}
        >
          <span style={{ background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.45) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Crea tu
          </span>{' '}
          <span style={{ color: '#4da3ff' }}>cuenta</span>
        </h1>
        <p className="text-center text-[15px] text-white/70 mt-2 mb-6">
          Completa tus datos para empezar tu formación.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-[13.5px] flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}
        {message ? (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-4 text-[14px] flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle size={18} /> {t('auth.check_email_for_verification')}
            </div>
            <p className="text-[13px] text-green-700">{t('auth.verification_email_sent_message')}</p>
            <Link href="/login" className="inline-flex items-center gap-2 text-[13px] font-semibold text-green-900 hover:underline">
              <ArrowRight size={14} /> {t('auth.login')}
            </Link>
          </div>
        ) : (
          <FormLayout onSubmit={formik.handleSubmit}>
            <div className="flex flex-col gap-4 text-left">
              <Form.Field name="email" className="flex flex-col gap-1.5">
                <Form.Label className={labelClass}>{t('auth.email')}</Form.Label>
                <Form.Control asChild>
                  <input type="email" placeholder="tu@email.com" onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.email} autoComplete="email" required className={inputClass} />
                </Form.Control>
                {formik.touched.email && formik.errors.email && <p className="text-xs text-rose-300">{formik.errors.email as string}</p>}
              </Form.Field>

              <div className="grid grid-cols-2 gap-3">
                <Form.Field name="first_name" className="flex flex-col gap-1.5">
                  <Form.Label className={labelClass}>{t('user.first_name')}</Form.Label>
                  <Form.Control asChild>
                    <input type="text" onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.first_name} className={inputClass} />
                  </Form.Control>
                </Form.Field>
                <Form.Field name="last_name" className="flex flex-col gap-1.5">
                  <Form.Label className={labelClass}>{t('user.last_name')}</Form.Label>
                  <Form.Control asChild>
                    <input type="text" onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.last_name} className={inputClass} />
                  </Form.Control>
                </Form.Field>
              </div>

              <Form.Field name="username" className="flex flex-col gap-1.5">
                <Form.Label className={labelClass}>{t('user.username')}</Form.Label>
                <Form.Control asChild>
                  <input type="text" onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.username} required className={inputClass} />
                </Form.Control>
                {formik.touched.username && formik.errors.username && <p className="text-xs text-rose-300">{formik.errors.username as string}</p>}
              </Form.Field>

              <Form.Field name="password" className="flex flex-col gap-1.5">
                <Form.Label className={labelClass}>{t('auth.password')}</Form.Label>
                <div className="relative">
                  <Form.Control asChild>
                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••" onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.password} required className={`${inputClass} pr-11`} />
                  </Form.Control>
                  <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute top-1/2 right-3 -translate-y-1/2 text-[#1D0084]/60 hover:text-[#1D0084] transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={formik.values.password} />
                {formik.touched.password && formik.errors.password && <p className="text-xs text-rose-300">{formik.errors.password as string}</p>}
              </Form.Field>

              <Form.Submit asChild>
                <button className="mt-2 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]">
                  {isSubmitting ? t('common.loading') : (<>{t('auth.create_account')} <ArrowRight size={15} strokeWidth={2.5} /></>)}
                </button>
              </Form.Submit>
            </div>
          </FormLayout>
        )}
      </div>

      <Link href="/login" className="inline-flex items-center gap-2 text-[13px] text-white/55 hover:text-white/90 transition-colors">
        {t('auth.already_have_account')} <span className="text-white/85 underline underline-offset-2">{t('auth.login')}</span>
      </Link>
    </div>
  )
}

export default OpenSignUpComponent
