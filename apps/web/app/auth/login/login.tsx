'use client'
import FormLayout from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useFormik } from 'formik'
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Mail, Shield, X, Clock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { checkSSOEnabled, redirectToSSOLogin } from '@services/auth/sso'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@components/Contexts/AuthContext'
import { getLEARNHOUSE_TOP_DOMAIN_VAL, getDeploymentMode } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslation } from 'react-i18next'
import { resendVerificationEmail } from '@services/auth/auth'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import AuthShell from '@components/Auth/AuthShell'

interface LoginClientProps {
  org: any
}

const LoginClient = (props: LoginClientProps) => {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const router = useRouter();
  const session = useLHSession() as any;

  // Error state with type information
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationResent, setVerificationResent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)

  const handleGoogleSignIn = () => {
    // Store org context in cookies before OAuth redirect
    if (props.org?.slug) {
      const topDomain = getLEARNHOUSE_TOP_DOMAIN_VAL();
      const isSecure = window.location.protocol === 'https:';
      const secureAttr = isSecure ? '; secure' : '';
      const baseAttributes = `; path=/; SameSite=Lax${secureAttr}`;
      const domainAttr = topDomain === 'localhost' ? '' : `; domain=.${topDomain}`;
      document.cookie = `LH_oauth_orgslug=${props.org.slug}${baseAttributes}${domainAttr}`;
      document.cookie = `LH_oauth_org_id=${props.org.id}${baseAttributes}${domainAttr}`;
    }
    // Use absolute URL with current origin for custom domain support
    signIn('google', { callbackUrl: `${window.location.origin}/redirect_from_auth` });
  };

  // Check if SSO is enabled for this organization (requires enterprise plan)
  useEffect(() => {
    const checkSSO = async () => {
      // SSO is only available for enterprise plan (requires EE or SaaS/enterprise)
      const orgConfig = props.org?.config?.config
      const plan = orgConfig?.plan ?? orgConfig?.cloud?.plan
      const mode = getDeploymentMode()
      if (mode === 'oss' || (mode === 'saas' && plan !== 'enterprise')) {
        setSsoEnabled(false)
        return
      }

      if (props.org?.slug) {
        try {
          const result = await checkSSOEnabled(props.org.slug)
          setSsoEnabled(result.sso_enabled)
        } catch (error) {
          // SSO not available, silently ignore
          console.debug('SSO check failed:', error)
        }
      }
    }
    checkSSO()
  }, [props.org?.slug, props.org?.config?.config?.plan, props.org?.config?.config?.cloud?.plan]) // eslint-disable-line

  const handleSSOLogin = async () => {
    setSsoLoading(true)
    try {
      await redirectToSSOLogin(props.org.slug)
    } catch (error: any) {
      setError(error.message || t('auth.sso_error'))
      setSsoLoading(false)
    }
  }

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
      errors.email = t('validation.required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = t('validation.invalid_email')
    }

    if (!values.password) {
      errors.password = t('validation.required')
    } else if (values.password.length < 8) {
      errors.password = t('validation.password_min_length')
    }

    return errors
  }

  const handleResendVerification = async () => {
    if (!unverifiedEmail || !props.org?.id) return

    setIsResendingVerification(true)
    try {
      const res = await resendVerificationEmail(unverifiedEmail, props.org.id)
      if (res.success) {
        setVerificationResent(true)
      } else {
        setError(res.error || t('auth.resend_verification_failed'))
      }
    } catch (err) {
      setError(t('auth.resend_verification_failed'))
    } finally {
      setIsResendingVerification(false)
    }
  }

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values, {validateForm, setErrors, setSubmitting}) => {
      setIsSubmitting(true)
      setError('')
      setErrorType(null)
      setUnverifiedEmail(null)
      setVerificationResent(false)
      setShowErrorModal(false)
      setRetryAfter(null)

      const errors = await validateForm(values);
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        setSubmitting(false);
        setIsSubmitting(false);
        return;
      }

      // Use absolute URL with current origin for custom domain support
      const callbackUrl = `${window.location.origin}/redirect_from_auth`;

      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl
      });

      if (res && res.error) {
        // Try to parse the error message for error codes
        try {
          // The error from next-auth might contain our structured error
          const errorData = JSON.parse(res.error);
          if (errorData.code) {
            setErrorType(errorData.code);
            // Use our Spanish copy for known codes; never surface the backend's
            // English message (e.g. "Incorrect Email or password").
            if (errorData.code === 'EMAIL_NOT_VERIFIED') {
              setError(t('auth.email_not_verified_message'));
              setUnverifiedEmail(errorData.email || values.email);
            } else if (errorData.code === 'ACCOUNT_LOCKED') {
              setError(t('auth.account_locked_message'));
            } else if (errorData.code === 'RATE_LIMITED') {
              setError(t('auth.rate_limited_message'));
            } else {
              setError(t('auth.wrong_email_password'));
            }
            if (errorData.retry_after) {
              setRetryAfter(errorData.retry_after);
            }
          } else {
            setError(t('auth.wrong_email_password'));
          }
        } catch {
          // If parsing fails, check for specific error strings
          if (res.error.includes('EMAIL_NOT_VERIFIED')) {
            setErrorType('EMAIL_NOT_VERIFIED');
            setError(t('auth.email_not_verified_message'));
            setUnverifiedEmail(values.email);
          } else if (res.error.includes('ACCOUNT_LOCKED')) {
            setErrorType('ACCOUNT_LOCKED');
            setError(t('auth.account_locked_message'));
          } else if (res.error.includes('RATE_LIMITED')) {
            setErrorType('RATE_LIMITED');
            setError(t('auth.rate_limited_message'));
          } else {
            setError(t('auth.wrong_email_password'));
          }
        }
        setShowErrorModal(true);
        setIsSubmitting(false);
      } else {
        // First signIn already authenticated and set cookies — just redirect
        window.location.href = callbackUrl;
      }
    },
  })

  return (
    <AuthShell>
        {/* Error Top Bar */}
        {showErrorModal && (
          <div className={`
            absolute top-0 inset-x-0 z-10 w-full px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-200
            ${errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent ? 'bg-amber-500 text-white' : ''}
            ${verificationResent ? 'bg-green-500 text-white' : ''}
            ${errorType === 'ACCOUNT_LOCKED' ? 'bg-red-500 text-white' : ''}
            ${errorType === 'RATE_LIMITED' ? 'bg-orange-500 text-white' : ''}
            ${error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' ? 'bg-red-500 text-white' : ''}
          `}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && <Mail size={18} className="shrink-0" />}
              {verificationResent && <Mail size={18} className="shrink-0" />}
              {errorType === 'ACCOUNT_LOCKED' && <Lock size={18} className="shrink-0" />}
              {errorType === 'RATE_LIMITED' && <Clock size={18} className="shrink-0" />}
              {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && <AlertTriangle size={18} className="shrink-0" />}

              <div className="flex-1 min-w-0">
                {errorType === 'EMAIL_NOT_VERIFIED' && !verificationResent && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{t('auth.email_not_verified_message')}</span>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResendingVerification}
                      className="text-sm underline hover:no-underline disabled:opacity-50"
                    >
                      {isResendingVerification ? t('common.loading') : t('auth.resend_verification_email')}
                    </button>
                  </div>
                )}
                {verificationResent && (
                  <span className="text-sm font-medium">{t('auth.verification_email_resent')} - {t('auth.check_inbox_message')}</span>
                )}
                {errorType === 'ACCOUNT_LOCKED' && (
                  <span className="text-sm font-medium">
                    {t('auth.account_locked')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {errorType === 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">
                    {t('auth.rate_limited')}
                    {retryAfter ? ` · ${t('auth.try_again_in', { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })}` : ''}
                  </span>
                )}
                {error && !verificationResent && errorType !== 'EMAIL_NOT_VERIFIED' && errorType !== 'ACCOUNT_LOCKED' && errorType !== 'RATE_LIMITED' && (
                  <span className="text-sm font-medium">{error}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setShowErrorModal(false)
                if (verificationResent) setVerificationResent(false)
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="relative z-0 w-full max-w-[420px] flex flex-col items-center gap-8">
          {/* Open block — no glass card, matches the nawar-web look.
              Logo intentionally omitted: the AuthShell navbar already
              carries the Nawar logo at the top of every auth screen. */}
          <div className="w-full text-white/95">
            {/* Title — same treatment as nawar-web hero on the landing:
                Poppins 700, -0.03em tracking, white→45%-white gradient
                identical to .text-gradient-white in the brand stylesheet.
                Continues the home hero look on the auth screens. */}
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
                Bienvenid@
              </span>{' '}
              <span style={{ color: '#4da3ff' }}>de vuelta</span>
            </h1>
            <p className="text-center text-[15px] text-white/70 mt-2 mb-7">
              Accede a tu plataforma de alumno.
            </p>

          {/* Form — open block (no card), inputs in #F0F5FF with brand-blue text */}
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
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors"
                  />
                </Form.Control>
                {formik.touched.email && formik.errors.email && (
                  <p className="text-xs text-rose-300">{formik.errors.email as string}</p>
                )}
              </Form.Field>

              <Form.Field name="password" className="flex flex-col gap-1.5">
                <Form.Label className="text-[13px] font-semibold text-white/90 tracking-[0.01em]">
                  {t('auth.password')}
                </Form.Label>
                <div className="relative">
                  <Form.Control asChild>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      value={formik.values.password}
                      className="w-full px-4 py-3.5 pr-11 rounded-xl bg-[#F0F5FF] hover:bg-[#E5ECFF] focus:bg-white text-[#1D0084] placeholder:text-[#1D0084]/45 outline-none border border-transparent focus:border-[#4da3ff] focus:ring-[3px] focus:ring-[#4da3ff]/22 text-[15px] transition-colors"
                    />
                  </Form.Control>
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1D0084]/60 hover:text-[#1D0084] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password && (
                  <p className="text-xs text-rose-300">{formik.errors.password as string}</p>
                )}
              </Form.Field>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-[12.5px] text-white/75 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 text-[#4da3ff] cursor-pointer"
                  />
                  Recuérdame
                </label>
                <Link
                  href="/forgot"
                  className="text-[12.5px] text-white/75 hover:text-white underline underline-offset-2 transition-colors"
                >
                  {t('auth.forgot_password')}
                </Link>
              </div>

              <Form.Submit asChild>
                <button className="mt-2 w-full inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#1D0084] font-bold py-3.5 rounded-xl transition-colors text-[15px]">
                  {isSubmitting ? t('common.loading') : (
                    <>
                      Entrar
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </Form.Submit>

              <p className="text-center text-[13px] text-white/55 mt-4">
                ¿Problemas para entrar?{' '}
                <a
                  href="https://www.holandesnawar.com/contacto"
                  className="text-white/85 underline underline-offset-2 hover:text-white transition-colors"
                >
                  Escríbenos
                </a>
                .
              </p>
            </div>
          </FormLayout>
          </div>

          <a
            href="https://www.holandesnawar.com"
            className="text-[13px] text-white/55 hover:text-white/90 transition-colors"
          >
            ← Volver al inicio
          </a>
        </div>
    </AuthShell>
  )
}

export default LoginClient
