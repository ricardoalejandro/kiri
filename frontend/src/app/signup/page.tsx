'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Check, Eye, EyeOff, Lock, MessageSquare, Sparkles } from 'lucide-react'
import { markAuthSession } from '@/lib/api'
import PublicPageScroll from '@/components/PublicPageScroll'
import PasswordStrengthChecklist, { getPasswordIssues } from '@/components/PasswordStrengthChecklist'

const fallbackTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

type TurnstileWidgetID = string | number

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => TurnstileWidgetID
      reset: (widgetId?: TurnstileWidgetID) => void
      remove: (widgetId: TurnstileWidgetID) => void
    }
  }
}

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ account_name: '', display_name: '', email: '', password: '', password_confirm: '' })
  const [website, setWebsite] = useState('')
  const [formStartedAt] = useState(() => Date.now())
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(fallbackTurnstileSiteKey)
  const [signupEnabled, setSignupEnabled] = useState(Boolean(fallbackTurnstileSiteKey))
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetID | null>(null)

  useEffect(() => {
    fetch('/api/public/signup-config')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return
        if (typeof data.turnstile_site_key === 'string') {
          setTurnstileSiteKey(data.turnstile_site_key)
        }
        setSignupEnabled(Boolean(data.signup_enabled && data.turnstile_site_key))
      })
      .catch(() => {
        setSignupEnabled(Boolean(fallbackTurnstileSiteKey))
      })
  }, [])

  useEffect(() => {
    if (window.turnstile) {
      setTurnstileReady(true)
    }
  }, [turnstileSiteKey])

  const renderTurnstile = useCallback(() => {
    if (!turnstileSiteKey || !turnstileReady || !window.turnstile || !turnstileRef.current || widgetIdRef.current !== null) return
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      callback: (token) => {
        setTurnstileToken(token)
        setError('')
      },
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => {
        setTurnstileToken('')
        setError('No se pudo completar la verificación de seguridad. Intenta nuevamente.')
      },
    })
  }, [turnstileReady, turnstileSiteKey])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('')
    if (window.turnstile && widgetIdRef.current !== null) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [])

  useEffect(() => {
    renderTurnstile()
    return () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderTurnstile])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    if (form.password !== form.password_confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    const issues = getPasswordIssues(form.password)
    if (issues.length > 0) {
      setError(`Usa una contraseña fuerte: ${issues.join(', ')}.`)
      return
    }
    if (!signupEnabled || !turnstileSiteKey) {
      setError('Registro temporalmente no disponible. Falta configurar la verificación de seguridad.')
      return
    }
    if (!turnstileToken) {
      setError('Completa la verificación de seguridad para crear la cuenta.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          turnstile_token: turnstileToken,
          form_started_at: formStartedAt,
          website,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          utm_source: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_source') || '' : '',
          utm_medium: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_medium') || '' : '',
          utm_campaign: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('utm_campaign') || '' : '',
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'No se pudo crear la cuenta')
        resetTurnstile()
        return
      }
      if (data.user) {
        markAuthSession()
        router.push('/dashboard')
        router.refresh()
        return
      }
      setSuccessMessage(data.message || 'Tu cuenta fue recibida y está pendiente de aprobación.')
      resetTurnstile()
    } catch {
      setError('Error de conexión')
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  function generatePassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnopqrstuvwxyz'
    const digits = '23456789'
    const symbols = '!@#$%*?'
    const all = upper + lower + digits + symbols
    const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)]
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
    for (let i = chars.length; i < 16; i++) chars.push(pick(all))
    return chars.sort(() => Math.random() - 0.5).join('')
  }

  function applyGeneratedPassword() {
    const password = generatePassword()
    setForm(f => ({ ...f, password, password_confirm: password }))
    setShowPassword(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicPageScroll />
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />
      )}
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Kiri</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8 lg:py-10">
        <div className="w-full max-w-4xl">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200 p-6 lg:p-7">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  Cuenta gratuita de prueba
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Crea tu cuenta gratis</h1>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">Explora Kiri sin límite de tiempo mientras seguimos preparando los planes comerciales.</p>
                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  {['1 usuario incluido', 'Hasta 5 dispositivos WhatsApp', '100 MB de almacenamiento inicial'].map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-emerald-100 bg-white/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Registro seguro</p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Cada solicitud queda pendiente de aprobación y nace con límites controlados.
                </p>
              </div>
            </div>

            <div className="p-6 lg:p-7">

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5">
                  {error}
                </div>
              )}

              {successMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-emerald-950">Solicitud recibida</h2>
                      <p className="text-sm text-emerald-800 mt-1 leading-relaxed">{successMessage}</p>
                      <p className="text-xs text-emerald-700 mt-3">Cuando un superadmin la apruebe, podrás iniciar sesión con tu correo.</p>
                      <Link href="/login" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                        Ir a iniciar sesión <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSignup} className="space-y-3.5">
                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Empresa" value={form.account_name} onChange={(v) => setForm((f) => ({ ...f, account_name: v }))} placeholder="Mi empresa" disabled={loading} />
                  <Field
                    label="Nombre visible"
                    value={form.display_name}
                    onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                    placeholder="Tu nombre completo"
                    hint="Se mostrará dentro de Kiri."
                    disabled={loading}
                  />
                </div>
                <Field
                  label="Correo / usuario de acceso"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="ventas@empresa.com"
                  hint="Usarás este correo para iniciar sesión."
                  disabled={loading}
                />

                <div>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Contraseña</label>
                    <button type="button" onClick={applyGeneratedPassword} className="text-xs font-semibold text-emerald-700 hover:underline" disabled={loading}>
                      Generar segura
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="mínimo 10, Aa1!"
                      className="w-full pl-11 pr-11 py-2.5 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
                      minLength={8}
                      required
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" disabled={loading}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password_confirm}
                    onChange={(e) => setForm((f) => ({ ...f, password_confirm: e.target.value }))}
                    placeholder="repite la contraseña"
                    className="mt-2 w-full px-3.5 py-2.5 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
                    minLength={10}
                    required
                    disabled={loading}
                  />
                  <div className="mt-3">
                    <PasswordStrengthChecklist password={form.password} confirmPassword={form.password_confirm} />
                  </div>
                </div>

                <div className="min-h-[70px] flex items-center justify-center pt-1">
                  {turnstileSiteKey && signupEnabled ? (
                    <div ref={turnstileRef} />
                  ) : (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Estamos activando el registro seguro.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  disabled={loading || !signupEnabled || !turnstileSiteKey || getPasswordIssues(form.password, form.password_confirm).length > 0}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      Enviar solicitud <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  ¿Ya tienes cuenta?{' '}
                  <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                    Inicia sesión
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, hint, type = 'text', disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint?: string; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
        required
        disabled={disabled}
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>}
    </div>
  )
}
