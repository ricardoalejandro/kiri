'use client'

import { useEffect, useState } from 'react'
import {
  Building2, Users, Plus, Pencil, Trash2, Power, KeyRound,
  Search, X, Shield, ChevronDown, Link2, Lock, CheckSquare, Square,
  HardDrive, Database, AlertTriangle, Eye, CheckCircle2, XCircle, Ban, Clock
} from 'lucide-react'

interface Account {
  id: string
  account_code: string
  name: string
  company_name: string
  slug: string
  plan: string
  max_devices: number
  max_users_override?: number | null
  max_users_effective?: number
  storage_limit_bytes: number
  is_active: boolean
  creation_source: string
  review_status: string
  signup_request_id?: string | null
  signup_risk_score: number
  signup_risk_reasons?: string[]
  subscription_status?: string
  trial_ends_at?: string | null
  current_period_end?: string | null
  grace_ends_at?: string | null
  user_count: number
  device_count: number
  chat_count: number
  signup_email?: string
  signup_email_domain?: string
  signup_contact_name?: string
  signup_ip_hash?: string
  signup_fingerprint_hash?: string
  signup_user_agent_hash?: string
  signup_turnstile_success?: boolean
  signup_referrer?: string
  signup_utm_source?: string
  signup_utm_medium?: string
  signup_utm_campaign?: string
  signup_created_at?: string | null
  created_at: string
}

interface Plan {
  code: string
  name: string
  description: string
  trial_days: number
  is_public: boolean
  sort_order: number
  entitlements?: Record<string, unknown>
}

interface User {
  id: string
  account_id: string
  username: string
  email: string
  display_name: string
  role: string
  is_admin: boolean
  is_super_admin: boolean
  is_active: boolean
  creation_source: string
  email_verified: boolean
  last_login_at?: string | null
  account_name: string
  account_code?: string
  account_company_name?: string
  account_creation_source?: string
  account_review_status?: string
  accounts?: UserAccountAssignment[]
  created_at: string
}

interface UserAccountAssignment {
  account_id: string
  account_name: string
  account_code?: string
  account_company_name?: string
  account_slug: string
  account_creation_source?: string
  account_review_status?: string
  role: string
  role_id?: string
  role_name?: string
  permissions?: string[]
  is_default: boolean
}

interface SecurityEvent {
  id: string
  type: string
  subject_hash: string
  ip_hash: string
  user_agent_hash: string
  metadata?: Record<string, unknown>
  created_at: string
}

interface Role {
  id: string
  name: string
  description: string
  is_system: boolean
  is_public_signup_default: boolean
  permissions: string[]
  created_at: string
}

interface NewUserAssignment {
  account_id: string
  role: string
  role_id: string
  is_default: boolean
}

const ALL_MODULES = [
  { key: 'chats', label: 'Chats', color: 'emerald' },
  { key: 'contacts', label: 'Contactos', color: 'blue' },
  { key: 'leads', label: 'Leads', color: 'violet' },
  { key: 'automations', label: 'Automatizaciones', color: 'emerald' },
  { key: 'bots', label: 'Bots', color: 'sky' },
  { key: 'devices', label: 'Dispositivos', color: 'cyan' },
  { key: 'broadcasts', label: 'Difusión', color: 'yellow' },
  { key: 'tags', label: 'Etiquetas', color: 'teal' },
  { key: 'integrations', label: 'Integraciones', color: 'cyan' },
  { key: 'whatsapp_api', label: 'WhatsApp API', color: 'emerald' },
  { key: 'settings', label: 'Configuración', color: 'slate' },
  { key: 'tasks', label: 'Tareas', color: 'lime' },
  { key: 'documents', label: 'Plantillas', color: 'purple' },
  { key: 'admin', label: 'Admin', color: 'red' },
]

function formatBytes(bytes?: number) {
  const value = bytes || 0
  if (value <= 0) return 'Ilimitado'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return `${size >= 10 || idx === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[idx]}`
}

function gbToBytes(value: number) {
  return Math.max(0, Math.round(value * 1024 * 1024 * 1024))
}

function bytesToGb(value?: number) {
  return value && value > 0 ? Math.round((value / 1024 / 1024 / 1024) * 10) / 10 : 0
}

type Tab = 'accounts' | 'users' | 'roles'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('accounts')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAccountId, setFilterAccountId] = useState('')
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showPurgeModal, setShowPurgeModal] = useState(false)
  const [detailAccount, setDetailAccount] = useState<Account | null>(null)
  const [accountEvents, setAccountEvents] = useState<SecurityEvent[]>([])
  const [accountEventsLoading, setAccountEventsLoading] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleForm, setRoleForm] = useState<{ name: string; description: string; is_public_signup_default: boolean; permissions: string[] }>({ name: '', description: '', is_public_signup_default: false, permissions: [] })
  const [passwordUserId, setPasswordUserId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [assignUserId, setAssignUserId] = useState('')
  const [assignUserName, setAssignUserName] = useState('')
  const [assignAccountId, setAssignAccountId] = useState('')
  const [assignRole, setAssignRole] = useState('agent')
  const [assignRoleId, setAssignRoleId] = useState('')
  const [userAssignments, setUserAssignments] = useState<UserAccountAssignment[]>([])
  const [purgeAccount, setPurgeAccount] = useState<Account | null>(null)
  const [purgeSummary, setPurgeSummary] = useState<{ tables?: Record<string, number | null>; storage_objects?: number } | null>(null)
  const [purgeConfirmation, setPurgeConfirmation] = useState('')
  const [purgeDeleteFiles, setPurgeDeleteFiles] = useState(true)
  const purgeTables = purgeSummary?.tables
  const purgeRecordCount = purgeTables ? Object.values(purgeTables).reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0) : 0
  const purgeStorageObjects = purgeSummary?.storage_objects ?? 0

  // Account form
  const [accountForm, setAccountForm] = useState({
    name: '', company_name: '', slug: '', plan: 'basic', max_devices: 5, max_users_override: '', storage_limit_gb: 0,
    subscription_status: 'active', trial_ends_at: '', current_period_end: ''
  })

  // User form
  const [userForm, setUserForm] = useState({
    account_id: '', username: '', email: '', password: '', display_name: '', role: 'agent'
  })
  const [userFormAssignments, setUserFormAssignments] = useState<NewUserAssignment[]>([])

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/admin/accounts', { headers })
      const data = await res.json()
      if (data.success) setAccounts(data.accounts || [])
    } catch (e) {
      console.error('Failed to fetch accounts:', e)
    }
  }

  async function fetchUsers() {
    try {
      const url = filterAccountId
        ? `/api/admin/users?account_id=${filterAccountId}`
        : '/api/admin/users'
      const res = await fetch(url, { headers })
      const data = await res.json()
      if (data.success) setUsers(data.users || [])
    } catch (e) {
      console.error('Failed to fetch users:', e)
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch('/api/admin/plans', { headers })
      const data = await res.json()
      if (data.success) setPlans(data.plans || [])
    } catch (e) {
      console.error('Failed to fetch plans:', e)
    }
  }

  async function fetchRoles() {
    try {
      const res = await fetch('/api/admin/roles', { headers })
      const data = await res.json()
      if (data.success) setRoles(data.roles || [])
    } catch (e) {
      console.error('Failed to fetch roles:', e)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAccounts(), fetchUsers(), fetchPlans(), fetchRoles()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [filterAccountId])

  // Close modals on Escape (topmost first)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (detailAccount) { setDetailAccount(null); return }
      if (showPasswordModal) { setShowPasswordModal(false); return }
      if (showPurgeModal) { setShowPurgeModal(false); return }
      if (showRoleModal) { setShowRoleModal(false); return }
      if (showAssignModal) { setShowAssignModal(false); return }
      if (showUserModal) { setShowUserModal(false); return }
      if (showAccountModal) { setShowAccountModal(false); return }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [detailAccount, showPasswordModal, showPurgeModal, showRoleModal, showAssignModal, showUserModal, showAccountModal])

  // Account CRUD
  function openCreateAccount() {
    setEditingAccount(null)
    setAccountForm({ name: '', company_name: '', slug: '', plan: 'basic', max_devices: 5, max_users_override: '', storage_limit_gb: 0, subscription_status: 'active', trial_ends_at: '', current_period_end: '' })
    setShowAccountModal(true)
  }

  function openEditAccount(a: Account) {
    setEditingAccount(a)
    setAccountForm({
      name: a.name,
      company_name: a.company_name || a.name,
      slug: a.slug,
      plan: a.plan,
      max_devices: a.max_devices,
      max_users_override: a.max_users_override != null ? String(a.max_users_override) : '',
      storage_limit_gb: bytesToGb(a.storage_limit_bytes),
      subscription_status: a.subscription_status || 'active',
      trial_ends_at: dateInputValue(a.trial_ends_at),
      current_period_end: dateInputValue(a.current_period_end),
    })
    setShowAccountModal(true)
  }

  async function saveAccount() {
    const method = editingAccount ? 'PUT' : 'POST'
    const url = editingAccount
      ? `/api/admin/accounts/${editingAccount.id}`
      : '/api/admin/accounts'

    const accountPayload = {
      name: accountForm.name,
      company_name: accountForm.company_name,
      slug: accountForm.slug,
      plan: accountForm.plan,
      max_devices: accountForm.max_devices,
      max_users_override: accountForm.max_users_override === '' ? null : Math.max(0, parseInt(accountForm.max_users_override, 10) || 0),
      storage_limit_bytes: gbToBytes(accountForm.storage_limit_gb),
    }

    const res = await fetch(url, { method, headers, body: JSON.stringify(accountPayload) })
    const data = await res.json()
    if (data.success) {
      const accountId = editingAccount?.id || data.account?.id
      if (accountId) {
        const subRes = await fetch(`/api/admin/accounts/${accountId}/subscription`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            plan_code: accountForm.plan,
            status: accountForm.subscription_status,
            trial_ends_at: accountForm.trial_ends_at,
            current_period_end: accountForm.current_period_end,
          }),
        })
        const subData = await subRes.json()
        if (!subData.success) {
          alert(subData.error || 'La cuenta se guardó, pero no se pudo actualizar la suscripción')
          return
        }
      }
      setShowAccountModal(false)
      fetchAccounts()
    } else {
      alert(data.error || 'Error al guardar')
    }
  }

  async function toggleAccount(id: string) {
    await fetch(`/api/admin/accounts/${id}/toggle`, { method: 'PATCH', headers })
    fetchAccounts()
  }

  async function openAccountDetail(account: Account) {
    setDetailAccount(account)
    setAccountEvents([])
    setAccountEventsLoading(true)
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/events`, { headers })
      const data = await res.json()
      if (data.success) setAccountEvents(data.events || [])
    } catch (e) {
      console.error('Failed to fetch account events:', e)
    } finally {
      setAccountEventsLoading(false)
    }
  }

  async function reviewAccount(account: Account, status: string) {
    const reason = status === 'approved' ? '' : window.prompt('Motivo de la revisión (opcional):') || ''
    const res = await fetch(`/api/admin/accounts/${account.id}/review`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, reason }),
    })
    const data = await res.json()
    if (!data.success) {
      alert(data.error || 'No se pudo actualizar la revisión')
      return
    }
    await fetchAccounts()
    if (detailAccount?.id === account.id) {
      setDetailAccount(data.account || { ...account, review_status: status, is_active: status === 'approved' ? true : account.is_active })
      openAccountDetail(data.account || { ...account, review_status: status })
    }
  }

  async function deleteAccount(id: string) {
    const account = accounts.find(a => a.id === id)
    if (!account) return
    if (account.device_count > 0 || account.chat_count > 0 || account.user_count > 0) {
      await openPurgeAccount(account)
      return
    }
    if (!confirm(`¿Eliminar la cuenta "${account.name}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/admin/accounts/${id}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (!data.success) { alert(data.error || 'Error al eliminar'); return }
    fetchAccounts()
    fetchUsers()
  }

  async function openPurgeAccount(account: Account) {
    setPurgeAccount(account)
    setPurgeSummary(null)
    setPurgeConfirmation('')
    setPurgeDeleteFiles(true)
    setShowPurgeModal(true)
    const res = await fetch(`/api/admin/accounts/${account.id}/purge-preview`, { headers })
    const data = await res.json()
    if (data.success) {
      setPurgeSummary(data.summary)
    } else {
      alert(data.error || 'Error al preparar la eliminación')
    }
  }

  async function purgeAccountNow() {
    if (!purgeAccount) return
    const res = await fetch(`/api/admin/accounts/${purgeAccount.id}/purge`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ confirmation: purgeConfirmation, delete_files: purgeDeleteFiles })
    })
    const data = await res.json()
    if (!data.success) {
      alert(data.error || 'Error al purgar cuenta')
      return
    }
    setShowPurgeModal(false)
    setPurgeAccount(null)
    await Promise.all([fetchAccounts(), fetchUsers()])
  }

  // User CRUD
  function openCreateUser() {
    setEditingUser(null)
    const initialAccount = filterAccountId || accounts.find(a => a.is_active)?.id || ''
    setUserForm({ account_id: initialAccount, username: '', email: '', password: '', display_name: '', role: 'agent' })
    setUserFormAssignments(initialAccount ? [{ account_id: initialAccount, role: 'agent', role_id: '', is_default: true }] : [])
    setShowUserModal(true)
  }

  function openEditUser(u: User) {
    setEditingUser(u)
    setUserForm({ account_id: u.account_id, username: u.username, email: u.email, password: '', display_name: u.display_name, role: u.role })
    setUserFormAssignments([])
    setShowUserModal(true)
  }

  function addUserFormAssignment() {
    const nextAccount = accounts.find(a => a.is_active && !userFormAssignments.some(ua => ua.account_id === a.id))
    if (!nextAccount) return
    setUserFormAssignments(prev => [...prev, { account_id: nextAccount.id, role: 'agent', role_id: '', is_default: prev.length === 0 }])
  }

  function updateUserFormAssignment(index: number, patch: Partial<NewUserAssignment>) {
    setUserFormAssignments(prev => prev.map((item, i) => {
      if (i !== index) return item
      const next = { ...item, ...patch }
      if (patch.role && patch.role !== 'agent') next.role_id = ''
      return next
    }).map((item, i) => patch.is_default && i !== index ? { ...item, is_default: false } : item))
  }

  function removeUserFormAssignment(index: number) {
    setUserFormAssignments(prev => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length > 0 && !next.some(item => item.is_default)) next[0] = { ...next[0], is_default: true }
      return next
    })
  }

  async function saveUser() {
    if (editingUser) {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ username: userForm.username, email: userForm.email, display_name: userForm.display_name, role: userForm.role })
      })
      const data = await res.json()
      if (data.success) {
        setShowUserModal(false)
        fetchUsers()
      } else {
        alert(data.error || 'Error al guardar')
      }
    } else {
      const validAssignments = userFormAssignments.filter(item => item.account_id)
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers, body: JSON.stringify({ ...userForm, accounts: validAssignments })
      })
      const data = await res.json()
      if (data.success) {
        setShowUserModal(false)
        fetchUsers()
      } else {
        alert(data.error || 'Error al crear usuario')
      }
    }
  }

  async function toggleUser(id: string) {
    await fetch(`/api/admin/users/${id}/toggle`, { method: 'PATCH', headers })
    fetchUsers()
  }

  async function deleteUser(id: string) {
    const user = users.find(u => u.id === id)
    if (!user) return
    if (user.is_super_admin) {
      alert('No se puede eliminar un super administrador')
      return
    }
    if (!confirm(`¿Eliminar al usuario "${user.display_name || user.username}"? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (!data.success) { alert(data.error || 'Error al eliminar'); return }
    fetchUsers()
  }

  async function resetPassword() {
    if (!newPassword) return
    if (newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres')
      return
    }
    const res = await fetch(`/api/admin/users/${passwordUserId}/password`, {
      method: 'PATCH', headers, body: JSON.stringify({ password: newPassword })
    })
    const data = await res.json()
    if (data.success) {
      setShowPasswordModal(false)
      setNewPassword('')
      alert('Contraseña actualizada')
    } else {
      alert(data.error || 'Error')
    }
  }

  // Account assignments
  async function openAssignModal(u: User) {
    setAssignUserId(u.id)
    setAssignUserName(u.display_name || u.username)
    setAssignAccountId('')
    setAssignRole('agent')
    setAssignRoleId('')
    setShowAssignModal(true)
    await fetchUserAssignments(u.id)
  }

  async function fetchUserAssignments(userId: string) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/accounts`, { headers })
      const data = await res.json()
      if (data.success) setUserAssignments(data.accounts || [])
    } catch (e) {
      console.error('Failed to fetch user accounts:', e)
    }
  }

  async function assignAccount() {
    if (!assignAccountId) return
    const body: Record<string, unknown> = { account_id: assignAccountId, role: assignRole }
    if (assignRoleId) body.role_id = assignRoleId
    const res = await fetch(`/api/admin/users/${assignUserId}/accounts`, {
      method: 'POST', headers,
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (data.success) {
      setAssignAccountId('')
      setAssignRole('agent')
      setAssignRoleId('')
      await fetchUserAssignments(assignUserId)
    } else {
      alert(data.error || 'Error al asignar')
    }
  }

  async function removeAssignment(accountId: string) {
    if (!confirm('¿Quitar esta cuenta del usuario?')) return
    const res = await fetch(`/api/admin/users/${assignUserId}/accounts/${accountId}`, {
      method: 'DELETE', headers
    })
    const data = await res.json()
    if (data.success) {
      await fetchUserAssignments(assignUserId)
    } else {
      alert(data.error || 'Error al quitar')
    }
  }

  const filteredAccounts = accounts.filter(a =>
    (a.account_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.signup_email || '').toLowerCase().includes(search.toLowerCase()) ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.plan.toLowerCase().includes(search.toLowerCase())
  )

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.account_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.account_company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  )

  // Role CRUD
  function openCreateRole() {
    setEditingRole(null)
    setRoleForm({ name: '', description: '', is_public_signup_default: false, permissions: [] })
    setShowRoleModal(true)
  }

  function openEditRole(r: Role) {
    setEditingRole(r)
    setRoleForm({ name: r.name, description: r.description, is_public_signup_default: Boolean(r.is_public_signup_default), permissions: [...r.permissions] })
    setShowRoleModal(true)
  }

  function toggleModulePermission(module: string) {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(module)
        ? f.permissions.filter(p => p !== module)
        : [...f.permissions, module]
    }))
  }

  async function saveRole() {
    if (!roleForm.name.trim()) { alert('El nombre del rol es requerido'); return }
    if (roleForm.is_public_signup_default && (roleForm.permissions.includes('admin') || roleForm.permissions.includes('*'))) {
      alert('El rol público por defecto no puede incluir el permiso Admin')
      return
    }
    const method = editingRole ? 'PUT' : 'POST'
    const url = editingRole ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles'
    const res = await fetch(url, { method, headers, body: JSON.stringify(roleForm) })
    const data = await res.json()
    if (data.success) {
      setShowRoleModal(false)
      fetchRoles()
    } else {
      alert(data.error || 'Error al guardar rol')
    }
  }

  async function deleteRole(id: string) {
    const role = roles.find(r => r.id === id)
    if (!role) return
    if (role.is_system) { alert('Los roles del sistema no pueden eliminarse'); return }
    if (role.is_public_signup_default) { alert('Primero marca otro rol seguro como registro público antes de eliminar este.'); return }
    if (!confirm(`¿Eliminar el rol "${role.name}"? Los usuarios asignados a este rol perderán sus permisos.`)) return
    const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (!data.success) { alert(data.error || 'Error al eliminar'); return }
    fetchRoles()
  }

  const planColors: Record<string, string> = {
    free: 'bg-slate-100 text-slate-600',
    trial: 'bg-amber-100 text-amber-700',
    basic: 'bg-gray-100 text-gray-700',
    starter: 'bg-emerald-100 text-emerald-700',
    pro: 'bg-blue-100 text-blue-700',
    business: 'bg-cyan-100 text-cyan-700',
    enterprise: 'bg-purple-100 text-purple-700',
    internal: 'bg-slate-800 text-white',
  }

  const subscriptionColors: Record<string, string> = {
    trialing: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    past_due: 'bg-orange-100 text-orange-700',
    grace: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-red-100 text-red-700',
    canceled: 'bg-slate-100 text-slate-500',
    incomplete: 'bg-gray-100 text-gray-600',
  }

  const subscriptionLabels: Record<string, string> = {
    trialing: 'Prueba',
    active: 'Activa',
    past_due: 'Pendiente',
    grace: 'Gracia',
    suspended: 'Suspendida',
    canceled: 'Cancelada',
    incomplete: 'Incompleta',
  }

  const sourceLabels: Record<string, string> = {
    public_web: 'Web',
    manual_admin: 'Manual',
    migration: 'Migración',
    api: 'API',
  }

  const sourceColors: Record<string, string> = {
    public_web: 'bg-emerald-100 text-emerald-700',
    manual_admin: 'bg-blue-100 text-blue-700',
    migration: 'bg-slate-100 text-slate-600',
    api: 'bg-cyan-100 text-cyan-700',
  }

  const reviewLabels: Record<string, string> = {
    pending_review: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    suspended: 'Suspendida',
  }

  const reviewColors: Record<string, string> = {
    pending_review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    suspended: 'bg-rose-100 text-rose-700',
  }

  function riskLabel(score?: number) {
    const value = score || 0
    if (value >= 60) return { text: `Alto (${value})`, cls: 'bg-red-100 text-red-700' }
    if (value >= 30) return { text: `Medio (${value})`, cls: 'bg-amber-100 text-amber-700' }
    return { text: `Bajo (${value})`, cls: 'bg-emerald-100 text-emerald-700' }
  }

  const fallbackPlans: Plan[] = [
    { code: 'basic', name: 'Basic', description: '', trial_days: 0, is_public: true, sort_order: 20 },
    { code: 'pro', name: 'Pro', description: '', trial_days: 14, is_public: true, sort_order: 40 },
    { code: 'enterprise', name: 'Enterprise', description: '', trial_days: 0, is_public: true, sort_order: 60 },
  ]

  const planOptions = plans.length > 0 ? plans : fallbackPlans

  function planMaxUsers(planCode: string) {
    const raw = planOptions.find(plan => plan.code === planCode)?.entitlements?.max_users
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : undefined
    return Number.isFinite(value) ? value : undefined
  }

  function userLimitLabel(account: Account) {
    const effective = account.max_users_effective ?? planMaxUsers(account.plan)
    return effective && effective > 0 ? `${account.user_count}/${effective}` : String(account.user_count)
  }

  function dateInputValue(value?: string | null) {
    if (!value) return ''
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toISOString().slice(0, 10)
  }

  function daysUntil(value?: string | null) {
    if (!value) return null
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    const diff = parsed.getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  }

  function subscriptionDateFor(account: Account) {
    if (account.subscription_status === 'trialing') return account.trial_ends_at
    if (account.subscription_status === 'grace') return account.grace_ends_at
    return account.current_period_end
  }

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    agent: 'Agente',
  }

  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-700',
    admin: 'bg-blue-100 text-blue-700',
    agent: 'bg-gray-100 text-gray-700',
  }

  function roleDisplay(role: string, roleId?: string, roleName?: string) {
    if (roleName) return roleName
    if (roleId) return roles.find(r => r.id === roleId)?.name || 'Rol manual'
    return roleLabels[role] || role
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-green-600" />
            Administración
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gestión de cuentas y usuarios de la plataforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-4">
        <button
          onClick={() => { setTab('accounts'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'accounts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" /> Cuentas
          <span className="ml-1 bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs">{accounts.length}</span>
        </button>
        <button
          onClick={() => { setTab('users'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" /> Usuarios
          <span className="ml-1 bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs">{users.length}</span>
        </button>
        <button
          onClick={() => { setTab('roles'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'roles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lock className="w-4 h-4" /> Roles
          <span className="ml-1 bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs">{roles.length}</span>
        </button>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={tab === 'accounts' ? 'Buscar cuentas...' : tab === 'users' ? 'Buscar usuarios...' : 'Buscar roles...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {tab === 'users' && (
          <select
            value={filterAccountId}
            onChange={e => setFilterAccountId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todas las cuentas</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {tab !== 'roles' ? (
          <button
            onClick={tab === 'accounts' ? openCreateAccount : openCreateUser}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {tab === 'accounts' ? 'Nueva Cuenta' : 'Nuevo Usuario'}
          </button>
        ) : (
          <button
            onClick={openCreateRole}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Nuevo Rol
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200">
        {tab === 'accounts' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cuenta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Origen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Revisión</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Riesgo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Suscripción</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Uso</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Espacio</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAccounts.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No se encontraron cuentas</td></tr>
              ) : filteredAccounts.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{a.account_code || a.name}</div>
                    <div className="text-sm text-gray-700">{a.company_name || a.name}</div>
                    {a.signup_email && <div className="text-xs text-gray-400">{a.signup_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sourceColors[a.creation_source] || 'bg-gray-100 text-gray-700'}`}>
                      {sourceLabels[a.creation_source] || a.creation_source || 'Manual'}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-1">{new Date(a.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${reviewColors[a.review_status] || 'bg-gray-100 text-gray-700'}`}>
                      {reviewLabels[a.review_status] || a.review_status || 'Aprobada'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const risk = riskLabel(a.signup_risk_score)
                      return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${risk.cls}`}>{risk.text}</span>
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${planColors[a.plan] || 'bg-gray-100 text-gray-700'}`}>
                      {a.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium ${subscriptionColors[a.subscription_status || 'active'] || 'bg-gray-100 text-gray-700'}`}>
                        {subscriptionLabels[a.subscription_status || 'active'] || a.subscription_status || 'Activa'}
                      </span>
                      {subscriptionDateFor(a) && (
                        <span className="text-[11px] text-gray-400">
                          {daysUntil(subscriptionDateFor(a))} días restantes
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    <div title="Usuarios">{userLimitLabel(a)} usr.</div>
                    <div title="Dispositivos">{a.device_count}/{a.max_devices} disp.</div>
                    <div title="Chats">{a.chat_count} chats</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{formatBytes(a.storage_limit_bytes)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openAccountDetail(a)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                      {a.review_status !== 'approved' && (
                        <button onClick={() => reviewAccount(a, 'approved')} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Aprobar">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {a.review_status !== 'suspended' && (
                        <button onClick={() => reviewAccount(a, 'suspended')} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Suspender">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEditAccount(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleAccount(a.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded" title={a.is_active ? 'Desactivar' : 'Activar'}>
                        <Power className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteAccount(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'users' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cuenta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Origen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Último acceso</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Rol</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No se encontraron usuarios</td></tr>
              ) : filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.display_name || u.username}</div>
                    <div className="text-xs text-gray-500">Usuario: {u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                    <div className="flex flex-wrap gap-1">
                      {(u.accounts || []).length > 0 ? (u.accounts || []).map(ua => (
                        <span key={ua.account_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700" title={ua.account_name}>
                          {ua.account_code || ua.account_name}
                          <span className="text-slate-400">·</span>
                          {ua.account_company_name || ua.account_name}
                          <span className="text-slate-400">·</span>
                          {roleDisplay(ua.role, ua.role_id, ua.role_name)}
                        </span>
                      )) : (
                        <span>{u.account_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sourceColors[u.creation_source] || 'bg-gray-100 text-gray-700'}`}>
                      {sourceLabels[u.creation_source] || u.creation_source || 'Manual'}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-1">{u.email_verified ? 'Email verificado' : 'Email sin verificar'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : <span className="text-gray-400">Sin acceso</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {roleDisplay(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditUser(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openAssignModal(u)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Gestionar cuentas">
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setPasswordUserId(u.id); setNewPassword(''); setShowPasswordModal(true) }} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded" title="Cambiar contraseña">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleUser(u.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded" title={u.is_active ? 'Desactivar' : 'Activar'}>
                        <Power className="w-4 h-4" />
                      </button>
                      {!u.is_super_admin && (
                        <button onClick={() => deleteUser(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'roles' ? (
          /* Roles Table */
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Permisos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRoles.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No se encontraron roles</td></tr>
              ) : filteredRoles.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    {r.description && <div className="text-xs text-gray-400 mt-0.5">{r.description}</div>}
                    {r.is_public_signup_default && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                        <Shield className="w-3 h-3" /> Registro público
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.permissions.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">Sin permisos</span>
                      ) : r.permissions.map(p => {
                        const mod = ALL_MODULES.find(m => m.key === p)
                        return (
                          <span key={p} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            {mod?.label || p}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.is_system ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Sistema</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Custom</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditRole(r)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {!r.is_system && !r.is_public_signup_default && (
                        <button onClick={() => deleteRole(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
	          </table>
	        ) : null}
      </div>

      {/* Account Detail Drawer */}
      {detailAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white h-full w-full max-w-2xl shadow-xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{detailAccount.account_code || detailAccount.name}</h2>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${reviewColors[detailAccount.review_status] || 'bg-gray-100 text-gray-700'}`}>
                    {reviewLabels[detailAccount.review_status] || detailAccount.review_status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{detailAccount.company_name || detailAccount.name}</p>
              </div>
              <button onClick={() => setDetailAccount(null)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Control de cuenta</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <InfoTile label="Origen" value={sourceLabels[detailAccount.creation_source] || detailAccount.creation_source || 'Manual'} />
                  <InfoTile label="Riesgo" value={riskLabel(detailAccount.signup_risk_score).text} />
                  <InfoTile label="Plan" value={detailAccount.plan} />
                  <InfoTile label="Suscripción" value={subscriptionLabels[detailAccount.subscription_status || 'active'] || detailAccount.subscription_status || 'Activa'} />
                  <InfoTile label="Usuarios" value={userLimitLabel(detailAccount)} />
                  <InfoTile label="Dispositivos" value={`${detailAccount.device_count}/${detailAccount.max_devices}`} />
                  <InfoTile label="Chats" value={String(detailAccount.chat_count)} />
                  <InfoTile label="Almacenamiento" value={formatBytes(detailAccount.storage_limit_bytes)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Procedencia del registro</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <InfoTile label="Contacto" value={detailAccount.signup_contact_name || 'No registrado'} />
                  <InfoTile label="Email" value={detailAccount.signup_email || 'No registrado'} />
                  <InfoTile label="Dominio" value={detailAccount.signup_email_domain || 'No registrado'} />
                  <InfoTile label="Turnstile" value={detailAccount.signup_turnstile_success ? 'Validado' : 'Sin dato'} />
                  <InfoTile label="IP hash" value={shortHash(detailAccount.signup_ip_hash)} />
                  <InfoTile label="Fingerprint hash" value={shortHash(detailAccount.signup_fingerprint_hash)} />
                  <InfoTile label="User-agent hash" value={shortHash(detailAccount.signup_user_agent_hash)} />
                  <InfoTile label="UTM" value={[detailAccount.signup_utm_source, detailAccount.signup_utm_medium, detailAccount.signup_utm_campaign].filter(Boolean).join(' / ') || 'Sin campaña'} />
                </div>
                {detailAccount.signup_referrer && (
                  <div className="mt-3 text-xs text-gray-500 break-all">Referer: {detailAccount.signup_referrer}</div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Acciones de revisión</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => reviewAccount(detailAccount, 'approved')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Aprobar
                  </button>
                  <button onClick={() => reviewAccount(detailAccount, 'pending_review')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-50">
                    <Clock className="w-4 h-4" /> En revisión
                  </button>
                  <button onClick={() => reviewAccount(detailAccount, 'suspended')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 text-sm font-medium hover:bg-rose-50">
                    <Ban className="w-4 h-4" /> Suspender
                  </button>
                  <button onClick={() => reviewAccount(detailAccount, 'rejected')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50">
                    <XCircle className="w-4 h-4" /> Rechazar
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Eventos recientes</h3>
                {accountEventsLoading ? (
                  <div className="text-sm text-gray-400">Cargando eventos...</div>
                ) : accountEvents.length === 0 ? (
                  <div className="text-sm text-gray-400">Sin eventos registrados.</div>
                ) : (
                  <div className="space-y-2">
                    {accountEvents.map(event => (
                      <div key={event.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900">{event.type}</span>
                          <span className="text-xs text-gray-400">{new Date(event.created_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          IP {shortHash(event.ip_hash)} · UA {shortHash(event.user_agent_hash)}
                        </div>
                        {event.metadata && (
                          <pre className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded p-2 overflow-auto max-h-24">{JSON.stringify(event.metadata, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRole ? 'Editar Rol' : 'Nuevo Rol'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Define qué módulos pueden acceder los usuarios con este rol</p>
              {editingRole?.is_system && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Rol base del sistema: puedes ajustar descripción y permisos, pero no renombrarlo ni eliminarlo.
                </p>
              )}
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del rol</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Vendedor, Soporte, Supervisor..."
                  disabled={editingRole?.is_system}
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  placeholder="Breve descripción del rol..."
                />
                </div>
              </div>
              <label className={`flex items-start gap-3 rounded-lg border p-3 ${
                roleForm.is_public_signup_default ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  checked={roleForm.is_public_signup_default}
                  onChange={e => setRoleForm(f => ({ ...f, is_public_signup_default: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Usar como rol por defecto del registro público</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Se asignará a las cuentas free creadas desde la web. No puede incluir permisos de administración.
                  </span>
                </span>
              </label>
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Módulos accesibles
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({roleForm.permissions.length} de {ALL_MODULES.length} seleccionados)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRoleForm(f => ({
                      ...f,
                      permissions: f.permissions.length === ALL_MODULES.length ? [] : ALL_MODULES.map(m => m.key)
                    }))}
                    className="text-xs text-emerald-600 hover:underline shrink-0"
                  >
                    {roleForm.permissions.length === ALL_MODULES.length ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_MODULES.map(mod => {
                    const active = roleForm.permissions.includes(mod.key)
                    return (
                      <button
                        key={mod.key}
                        type="button"
                        onClick={() => toggleModulePermission(mod.key)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {active
                          ? <CheckSquare className="w-4 h-4 shrink-0 text-emerald-500" />
                          : <Square className="w-4 h-4 shrink-0 text-gray-300" />
                        }
                        {mod.label}
                      </button>
                    )
                  })}
                </div>
                {roleForm.is_public_signup_default && (roleForm.permissions.includes('admin') || roleForm.permissions.includes('*')) && (
                  <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    Quita el permiso Admin para poder usar este rol en registros públicos.
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-white">
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button
                onClick={saveRole}
                disabled={roleForm.is_public_signup_default && (roleForm.permissions.includes('admin') || roleForm.permissions.includes('*'))}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingRole ? 'Guardar' : 'Crear Rol'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {editingAccount?.account_code && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Código interno:</span>{' '}
                  <span className="font-semibold text-slate-900">{editingAccount.account_code}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre interno</label>
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  placeholder="KIR-000001 o nombre administrativo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa visible</label>
                <input
                  type="text"
                  value={accountForm.company_name}
                  onChange={e => setAccountForm(f => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  placeholder="Nombre comercial o empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (opcional)</label>
                <input
                  type="text"
                  value={accountForm.slug}
                  onChange={e => setAccountForm(f => ({ ...f, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  placeholder="mi-cuenta"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <select
                    value={accountForm.plan}
                    onChange={e => setAccountForm(f => ({ ...f, plan: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    {planOptions.map(plan => (
                      <option key={plan.code} value={plan.code}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Dispositivos</label>
                  <input
                    type="number"
                    value={accountForm.max_devices}
                    onChange={e => setAccountForm(f => ({ ...f, max_devices: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Usuarios</label>
                  <input
                    type="number"
                    value={accountForm.max_users_override}
                    onChange={e => setAccountForm(f => ({ ...f, max_users_override: e.target.value === '' ? '' : String(Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    min={0}
                    placeholder={String(planMaxUsers(accountForm.plan) ?? '')}
                  />
                  <p className="mt-1 text-xs text-gray-400">Vacío usa el límite del plan.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Límite de almacenamiento (GB)</label>
                <input
                  type="number"
                  value={accountForm.storage_limit_gb}
                  onChange={e => setAccountForm(f => ({ ...f, storage_limit_gb: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  min={0}
                  step={0.5}
                />
                <p className="mt-1 text-xs text-gray-400">Usa 0 para dejar la cuenta sin límite.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={accountForm.subscription_status}
                    onChange={e => setAccountForm(f => ({ ...f, subscription_status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="active">Activa</option>
                    <option value="trialing">Prueba</option>
                    <option value="grace">Gracia</option>
                    <option value="past_due">Pendiente</option>
                    <option value="suspended">Suspendida</option>
                    <option value="canceled">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prueba hasta</label>
                  <input
                    type="date"
                    value={accountForm.trial_ends_at}
                    onChange={e => setAccountForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodo hasta</label>
                  <input
                    type="date"
                    value={accountForm.current_period_end}
                    onChange={e => setAccountForm(f => ({ ...f, current_period_end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowAccountModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={saveAccount} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                {editingAccount ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {!editingUser && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Cuentas y roles</label>
                    <button type="button" onClick={addUserFormAssignment} className="text-xs text-emerald-600 hover:underline disabled:text-gray-300" disabled={userFormAssignments.length >= accounts.filter(a => a.is_active).length}>
                      Agregar cuenta
                    </button>
                  </div>
                  <div className="space-y-2">
                    {userFormAssignments.map((assignment, index) => (
                      <div key={`${assignment.account_id}-${index}`} className="grid grid-cols-[1fr_120px_1fr_auto_auto] gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <select
                          value={assignment.account_id}
                          onChange={e => updateUserFormAssignment(index, { account_id: e.target.value })}
                          className="min-w-0 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Cuenta...</option>
                          {accounts.filter(a => a.is_active && (a.id === assignment.account_id || !userFormAssignments.some(ua => ua.account_id === a.id))).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        <select
                          value={assignment.role}
                          onChange={e => updateUserFormAssignment(index, { role: e.target.value })}
                          className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        >
                          <option value="agent">Agente</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                        <select
                          value={assignment.role_id}
                          onChange={e => updateUserFormAssignment(index, { role_id: e.target.value })}
                          disabled={assignment.role !== 'agent'}
                          className="min-w-0 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          <option value="">Rol manual...</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button type="button" onClick={() => updateUserFormAssignment(index, { is_default: true })} className={`px-2 py-2 rounded-lg text-xs font-medium ${assignment.is_default ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-gray-500 border border-gray-200'}`}>
                          Principal
                        </button>
                        <button type="button" onClick={() => removeUserFormAssignment(index)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" disabled={userFormAssignments.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {userFormAssignments.length === 0 && (
                      <button type="button" onClick={addUserFormAssignment} className="w-full px-3 py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600">
                        Agregar primera cuenta
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={userForm.display_name}
                    onChange={e => setUserForm(f => ({ ...f, display_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email opcional</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
              {editingUser && <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="agent">Agente</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={saveUser} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                {editingUser ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Cambiar Contraseña</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
              {(() => {
                const target = users.find(u => u.id === passwordUserId)
                return target ? (
                  <p className="mb-3 text-xs text-gray-500">
                    Login: <span className="font-medium text-gray-700">{target.username}</span>
                    {target.email && target.email !== target.username ? <> o <span className="font-medium text-gray-700">{target.email}</span></> : null}
                  </p>
                ) : null
              })()}
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                placeholder="Ingrese nueva contraseña"
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={resetPassword} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                Cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Assignments Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Cuentas de {assignUserName}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Gestiona las cuentas asignadas a este usuario</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Current assignments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cuentas asignadas</label>
                {userAssignments.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Sin cuentas asignadas</p>
                ) : (
                  <div className="space-y-2">
                    {userAssignments.map(ua => (
                      <div key={ua.account_id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-900">{ua.account_name}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[ua.role] || 'bg-gray-100 text-gray-700'}`}>
                            {roleDisplay(ua.role, ua.role_id, ua.role_name)}
                          </span>
                          {ua.is_default && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Principal
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeAssignment(ua.account_id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Quitar cuenta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new assignment */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Agregar cuenta</label>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={assignAccountId}
                    onChange={e => setAssignAccountId(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.filter(a => a.is_active && !userAssignments.some(ua => ua.account_id === a.id)).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <select
                    value={assignRole}
                    onChange={e => setAssignRole(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="agent">Agente</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  {assignRole === 'agent' && roles.length > 0 && (
                    <select
                      value={assignRoleId}
                      onChange={e => setAssignRoleId(e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Sin rol de permisos</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={assignAccount}
                    disabled={!assignAccountId}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {assignRole === 'agent' && assignRoleId && (
                  <p className="text-xs text-emerald-600 mt-1.5">
                    ✓ Permisos del rol: {roles.find(r => r.id === assignRoleId)?.permissions.map(p => ALL_MODULES.find(m => m.key === p)?.label || p).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPurgeModal && purgeAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-6 border-b border-gray-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Purgar cuenta</h2>
                <p className="text-sm text-gray-500 mt-1">Esta acción elimina la cuenta, sus datos relacionados y los archivos almacenados bajo su prefijo.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><Database className="w-4 h-4" /> Registros</div>
                  <div className="text-2xl font-semibold text-gray-900">{purgeTables ? purgeRecordCount : '...'}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1"><HardDrive className="w-4 h-4" /> Archivos</div>
                  <div className="text-2xl font-semibold text-gray-900">{purgeSummary ? purgeStorageObjects : '...'}</div>
                </div>
              </div>
              {purgeTables && (
                <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {Object.entries(purgeTables).filter(([, value]) => typeof value === 'number' && value > 0).map(([table, value]) => (
                    <div key={table} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-600">{table}</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-3 text-sm text-gray-700">
                <input type="checkbox" checked={purgeDeleteFiles} onChange={e => setPurgeDeleteFiles(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                Eliminar archivos de MinIO para esta cuenta
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escribe el nombre de la cuenta para confirmar</label>
                <input value={purgeConfirmation} onChange={e => setPurgeConfirmation(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500" placeholder={purgeAccount.name} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowPurgeModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={purgeAccountNow} disabled={purgeConfirmation !== purgeAccount.name} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Purgar cuenta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function shortHash(value?: string) {
  if (!value) return 'Sin dato'
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-800 break-words">{value}</div>
    </div>
  )
}
