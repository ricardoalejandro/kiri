'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, Lock, MessageSquare, User, ArrowLeft } from 'lucide-react'
import { markAuthSession } from '@/lib/api'
import PublicPageScroll from '@/components/PublicPageScroll'

const fallbackTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

type TurnstileWidgetID = string | number

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(fallbackTurnstileSiteKey)
  const [loginEnabled, setLoginEnabled] = useState(Boolean(fallbackTurnstileSiteKey))
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<TurnstileWidgetID | null>(null)

  const renderTurnstile = useCallback(() => {
    const turnstile = window.turnstile
    if (!turnstileSiteKey || !turnstileReady || !turnstile || !turnstileRef.current || widgetIdRef.current !== null) return
    widgetIdRef.current = turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      callback: (token: string) => {
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
    fetch('/api/public/signup-config')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return
        if (typeof data.turnstile_site_key === 'string') {
          setTurnstileSiteKey(data.turnstile_site_key)
        }
        setLoginEnabled(Boolean((data.login_enabled ?? data.signup_enabled) && data.turnstile_site_key))
      })
      .catch(() => {
        setLoginEnabled(Boolean(fallbackTurnstileSiteKey))
      })
  }, [])

  useEffect(() => {
    if (window.turnstile) {
      setTurnstileReady(true)
    }
  }, [turnstileSiteKey])

  useEffect(() => {
    renderTurnstile()
    return () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderTurnstile])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!loginEnabled || !turnstileSiteKey) {
      setError('Inicio de sesión temporalmente no disponible. Falta configurar la verificación de seguridad.')
      return
    }
    if (!turnstileToken) {
      setError('Completa la verificación de seguridad para iniciar sesión.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, turnstile_token: turnstileToken }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Error al iniciar sesión')
        resetTurnstile()
        return
      }
      markAuthSession()
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Error de conexión')
      resetTurnstile()
    } finally {
      setLoading(false)
    }
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

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Bienvenido de vuelta</h1>
                <p className="text-sm text-slate-500 mt-1">Ingresa a tu dashboard de Kiri.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Usuario
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="usuario o correo"
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="tu contraseña"
                      className="w-full pl-11 pr-11 py-3 bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all text-sm"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      disabled={loading}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="min-h-[70px] flex items-center justify-center">
                  {turnstileSiteKey && loginEnabled ? (
                    <div ref={turnstileRef} />
                  ) : (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Estamos activando el inicio de sesión seguro.
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  disabled={loading || !loginEnabled || !turnstileSiteKey}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      Iniciar sesión <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  ¿No tienes cuenta?{' '}
                  <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                    Crea una gratis
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
