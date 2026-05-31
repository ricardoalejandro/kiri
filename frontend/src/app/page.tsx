'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PublicPageScroll from '@/components/PublicPageScroll'
import {
  ArrowRight,
  BarChart3,
  Check,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Lock,
  Menu,
  X,
} from 'lucide-react'

const features = [
  { icon: MessageSquare, title: 'Bandeja WhatsApp para equipos', desc: 'Atiende todos tus numeros desde una sola vista, con historial, etiquetas, responsables y mensajes en tiempo real.' },
  { icon: Users, title: 'Contactos y leads ordenados', desc: 'Centraliza clientes, sincroniza fuentes externas y conserva el contexto comercial sin depender de hojas sueltas.' },
  { icon: BarChart3, title: 'Pipeline comercial visible', desc: 'Mira cada oportunidad por etapa, filtra por etiquetas y detecta rapido que conversaciones necesitan seguimiento.' },
  { icon: Zap, title: 'Campañas con control', desc: 'Prepara difusiones segmentadas, adjunta medios y mide estados de envio sin perder trazabilidad.' },
  { icon: ShieldCheck, title: 'Cuentas aisladas', desc: 'Cada empresa trabaja separada por cuenta, usuarios y permisos para mantener la operacion bajo control.' },
  { icon: Lock, title: 'Cuenta gratuita de prueba', desc: 'Empieza con una cuenta free sin limite de tiempo, con limites iniciales para probar el flujo real antes de escalar.' },
]

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://kiri.naperu.cloud').replace(/\/$/, '')
const LOGIN_URL = `${APP_URL}/login`
const SIGNUP_URL = `${APP_URL}/signup`

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <PublicPageScroll />
      {/* Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? 'border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm relative overflow-hidden">
              <span className="text-white font-black text-2xl leading-none -mt-0.5">K</span>
              <span className="absolute left-2 bottom-2 flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="w-1 h-1 rounded-full bg-white" />
              </span>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">Kiri</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#funciones" className="hover:text-emerald-600 transition-colors">Funciones</a>
            <a href="#registro" className="hover:text-emerald-600 transition-colors">Registro gratis</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href={LOGIN_URL}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2"
            >
              Ingresar
            </Link>
            <Link
              href={SIGNUP_URL}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              Crear cuenta free
            </Link>
          </div>

          <button className="md:hidden p-2 text-slate-600" onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <a href="#funciones" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 hover:text-emerald-600">Funciones</a>
            <a href="#registro" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-slate-600 hover:text-emerald-600">Registro gratis</a>
            <div className="pt-2 flex flex-col gap-2">
              <Link href={LOGIN_URL} className="text-center text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl py-2.5">Ingresar</Link>
              <Link href={SIGNUP_URL} className="text-center bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">Crear cuenta free</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(to_bottom,_#ecfdf5_0%,_#ffffff_48%,_#ffffff_100%)] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-20 lg:pt-24 lg:pb-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50/80 text-emerald-700 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              CRM para equipos que venden por WhatsApp
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
              Vende por WhatsApp sin perder{' '}
              <span className="text-emerald-600">leads, contexto ni control</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Kiri junta conversaciones, contactos, campañas, pipelines y tareas para que tu equipo responda mas rapido y cierre mejor.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={SIGNUP_URL}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-bold text-base transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                Crear cuenta free <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#funciones"
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-8 py-4 rounded-xl font-semibold text-base transition-colors flex items-center justify-center"
              >
                Conocer funciones
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
              {['Sin tarjeta de crédito', 'Cuenta free sin límite de tiempo', 'Límites iniciales para pruebas'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Product mockup */}
          <div className="mt-14 lg:mt-20 max-w-5xl mx-auto">
            <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-emerald-900/10 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="ml-4 flex-1 max-w-md">
                  <div className="bg-white border border-slate-200 rounded-md px-3 py-1 text-xs text-slate-400">kiri.naperu.cloud/dashboard</div>
                </div>
              </div>
              <div className="grid grid-cols-12 min-h-[360px]">
                <div className="col-span-3 border-r border-slate-100 bg-slate-50/70 p-4 space-y-3 hidden sm:block">
                  <div className="h-9 bg-emerald-600 rounded-lg px-3 flex items-center text-xs font-bold text-white">Chats activos</div>
                  {['Maria Lopez', 'Carlos Vera', 'Inmobiliaria Sur', 'Lead Iquitos', 'Nuevo contacto'].map((name, i) => (
                    <div key={name} className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 p-2">
                      <div className={`w-8 h-8 rounded-full ${i === 0 ? 'bg-emerald-100' : 'bg-slate-200'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-700">{name}</p>
                        <p className="truncate text-[11px] text-slate-400">{i === 0 ? 'Quiere una demo hoy' : 'Mensaje pendiente'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="col-span-12 sm:col-span-9 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Operación diaria</p>
                      <p className="text-xs text-slate-500">Chats, leads, contactos y dispositivos en una sola cuenta</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 px-3 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center">Free</div>
                      <div className="h-8 px-3 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold flex items-center">Seguro</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                      ['Chats', 'Conversaciones y respuestas del equipo'],
                      ['Leads', 'Seguimiento por etapas y etiquetas'],
                      ['Dispositivos', 'Conexión WhatsApp controlada'],
                    ].map(([label, hint]) => (
                      <div key={label} className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm">
                        <p className="text-sm font-bold text-slate-900">{label}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-4 bg-slate-50 p-3 border-b border-slate-100 text-xs font-semibold text-slate-400">
                      <span>Módulo</span>
                      <span>Estado</span>
                      <span>Uso</span>
                      <span>Control</span>
                    </div>
                    {[
                      ['Etiquetas', 'Activo', 'Organizar chats', 'Permisos por rol'],
                      ['Tareas', 'Activo', 'Seguimiento interno', 'Cuenta aislada'],
                      ['Configuración', 'Activo', 'Preferencias de cuenta', 'Solo usuarios autorizados'],
                      ['Almacenamiento', 'Limitado', 'Multimedia y archivos', 'Uso visible'],
                    ].map(([module, status, usage, control]) => (
                      <div key={module} className="grid grid-cols-4 p-3 items-center border-b border-slate-50 last:border-0 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                          <span className="truncate font-semibold text-slate-700">{module}</span>
                        </div>
                        <span className="w-fit rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{status}</span>
                        <span className="text-slate-500">{usage}</span>
                        <span className="truncate text-slate-500">{control}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Todo lo que necesitas para vender más</h2>
            <p className="mt-4 text-lg text-slate-600">Una plataforma completa que reemplaza las hojas de cálculo y los grupos de WhatsApp desordenados.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((item) => (
              <div key={item.title} className="group rounded-2xl p-6 transition-all hover:bg-emerald-50/40 border border-transparent hover:border-emerald-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-5 group-hover:bg-emerald-100 transition-colors">
                  <item.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg mb-2">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free account */}
      <section id="registro" className="py-16 lg:py-24 bg-slate-50/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Cuenta free sin límite de tiempo</h2>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                Kiri está en etapa de validación. Por ahora el registro público crea una cuenta gratuita con límites iniciales para probar la operación real sin comprometer planes comerciales todavía no definidos.
              </p>
            </div>
            <div className="grid gap-3">
              {['1 usuario para empezar', 'Hasta 5 dispositivos WhatsApp', '100 MB de almacenamiento inicial', 'Rol seguro configurable desde Admin'].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-emerald-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Crea tu cuenta gratuita de Kiri
          </h2>
          <p className="mt-4 text-emerald-100 text-lg max-w-2xl mx-auto">
            Prueba el flujo real de chats, contactos y leads mientras seguimos ajustando la plataforma.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={SIGNUP_URL}
              className="w-full sm:w-auto bg-white hover:bg-emerald-50 text-emerald-700 px-8 py-4 rounded-xl font-bold text-base transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              Crear cuenta gratis <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href={LOGIN_URL}
              className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500 px-8 py-4 rounded-xl font-semibold text-base transition-colors flex items-center justify-center"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-4 text-sm text-emerald-200/80">Sin tarjeta de crédito · Sin vencimiento automático de prueba</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900">Kiri</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                CRM WhatsApp para equipos comerciales que quieren crecer sin perder el control de sus conversaciones.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4 text-sm">Producto</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#funciones" className="hover:text-emerald-600 transition-colors">Funciones</a></li>
                <li><a href="#registro" className="hover:text-emerald-600 transition-colors">Cuenta free</a></li>
                <li><Link href={SIGNUP_URL} className="hover:text-emerald-600 transition-colors">Registro</Link></li>
                <li><Link href={LOGIN_URL} className="hover:text-emerald-600 transition-colors">Ingresar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Términos de servicio</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition-colors">Política de privacidad</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">© {new Date().getFullYear()} Kiri CRM. Todos los derechos reservados.</p>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              Seguro y confiable
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
