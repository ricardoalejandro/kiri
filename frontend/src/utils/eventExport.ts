/**
 * Event export utilities for CSV downloads.
 */
import { saveAs } from 'file-saver'
import { rowsToCsv } from './csv'

interface ExportEvent {
  id: string; name: string; description?: string; event_date?: string; event_end?: string
  location?: string; status: string; total_participants: number
  participant_counts?: Record<string, number>
}

interface ExportParticipant {
  id: string; name: string; last_name?: string; short_name?: string
  phone?: string; email?: string; age?: number; status: string
  notes?: string; invited_at?: string; confirmed_at?: string
  attended_at?: string; last_interaction?: string
  tags?: { name: string; color: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  invited: 'Invitado',
  contacted: 'Contactado',
  confirmed: 'Confirmado',
  declined: 'Declinado',
  attended: 'Asistió',
  no_show: 'No asistió',
}

function formatDate(d?: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

function formatDateTime(d?: string): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return d }
}

function buildRows(participants: ExportParticipant[]) {
  return participants.map((p, i) => ({
    '#': i + 1,
    'Nombre': p.name || '',
    'Apellido': p.last_name || '',
    'Nombre Corto': p.short_name || '',
    'Teléfono': p.phone || '',
    'Email': p.email || '',
    'Edad': p.age || '',
    'Estado': STATUS_LABELS[p.status] || p.status,
    'Etiquetas': (p.tags || []).map(t => t.name).join(', '),
    'Notas': p.notes || '',
    'Fecha Invitación': formatDateTime(p.invited_at),
    'Fecha Confirmación': formatDateTime(p.confirmed_at),
    'Fecha Asistencia': formatDateTime(p.attended_at),
    'Última Interacción': formatDateTime(p.last_interaction),
  }))
}

export function exportToExcel(event: ExportEvent, participants: ExportParticipant[]) {
  const rows = buildRows(participants)
  const blob = new Blob(['\uFEFF' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${sanitizeFilename(event.name)}_participantes.csv`)
}

export function exportToCSV(event: ExportEvent, participants: ExportParticipant[]) {
  const rows = buildRows(participants)
  const blob = new Blob(['\uFEFF' + rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${sanitizeFilename(event.name)}_participantes.csv`)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '').trim().replace(/\s+/g, '_')
}
