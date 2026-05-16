'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Plus, X, Trash2, CheckSquare, Square, MessageCircle, ShieldBan, Heart, ChevronDown, ChevronUp, MoreVertical, Archive, Tag, CheckCheck } from 'lucide-react'
import { formatTime } from '@/utils/format'
import { subscribeWebSocket } from '@/lib/api'
import DeviceSelector from '@/components/chat/DeviceSelector'
import NewChatModal from '@/components/chat/NewChatModal'
import ChatPanel from '@/components/chat/ChatPanel'
import ContactPanel from '@/components/chat/ContactPanel'
import { Chat, Device } from '@/types/chat'
import { getChatDisplayName, formatPhone } from '@/utils/chat'

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)

  // Filters & UI State
  const [filterDevices, setFilterDevices] = useState<string[]>([])
  const [filterUnread, setFilterUnread] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Reaction filter
  const [filterHasReaction, setFilterHasReaction] = useState(false)
  const [reactionFromMe, setReactionFromMe] = useState<'any' | 'client' | 'me'>('client')
  const [reactionEmojis, setReactionEmojis] = useState<string[]>([])
  const [reactionRange, setReactionRange] = useState<'any' | '1d' | '7d' | '30d' | 'custom'>('30d')
  const [reactionCustomFrom, setReactionCustomFrom] = useState('')
  const [reactionCustomTo, setReactionCustomTo] = useState('')
  const [showReactionAdvanced, setShowReactionAdvanced] = useState(false)

  // Infinite scroll state
  const CHATS_PAGE_SIZE = 50
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalChats, setTotalChats] = useState(0)
  const offsetRef = useRef(0)
  const chatListRef = useRef<HTMLDivElement>(null)

  // Resizable sidebar
  const [leftPanelWidth, setLeftPanelWidth] = useState(384) // default lg:w-96 = 384px
  const [rightPanelWidth, setRightPanelWidth] = useState(360) // contact detail panel
  const resizingRef = useRef<'left' | 'right' | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Contact info (3rd column)
  const [showContactInfo, setShowContactInfo] = useState(false)

  // Virtualizer for chat list
  const chatVirtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => chatListRef.current,
    estimateSize: () => 80,
    overscan: 10,
  })

  // Responsive
  const [isMdScreen, setIsMdScreen] = useState(true)
  useEffect(() => {
    const checkScreen = () => setIsMdScreen(window.matchMedia('(min-width: 768px)').matches)
    checkScreen()
    window.addEventListener('resize', checkScreen)
    return () => window.removeEventListener('resize', checkScreen)
  }, [])

  // Close panels on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selectedChat) { setSelectedChat(null); return }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [selectedChat])

  // Auto-open logic
  const autoOpenProcessedRef = useRef(false)

  // Fetch Data (supports pagination: reset=true reloads from scratch, reset=false appends)
  const fetchChats = useCallback(async (reset: boolean = true) => {
    const token = localStorage.getItem('token')
    const offset = reset ? 0 : offsetRef.current
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    try {
      const params = new URLSearchParams()
      filterDevices.forEach(id => params.append('device_ids', id))
      if (filterUnread) params.append('unread_only', 'true')
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (filterHasReaction) {
        params.append('has_reaction', 'true')
        if (reactionFromMe !== 'any') params.append('reaction_from_me', reactionFromMe === 'me' ? 'true' : 'false')
        reactionEmojis.forEach(e => params.append('reaction_emojis', e))
        const now = new Date()
        let since: Date | null = null
        let until: Date | null = null
        if (reactionRange === '1d') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        else if (reactionRange === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        else if (reactionRange === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        else if (reactionRange === 'custom') {
          if (reactionCustomFrom) since = new Date(reactionCustomFrom)
          if (reactionCustomTo) until = new Date(reactionCustomTo + 'T23:59:59')
        }
        if (since) params.append('reaction_since', since.toISOString())
        if (until) params.append('reaction_until', until.toISOString())
      }
      params.append('limit', String(CHATS_PAGE_SIZE))
      params.append('offset', String(offset))

      const res = await fetch(`/api/chats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        const newChats: Chat[] = data.chats || []
        const total: number = data.total ?? 0
        setTotalChats(total)

        if (reset) {
          setChats(newChats)
          offsetRef.current = newChats.length
        } else {
          // Append with deduplication
          setChats(prev => {
            const existingIds = new Set(prev.map(c => c.id))
            const unique = newChats.filter(c => !existingIds.has(c.id))
            return [...prev, ...unique]
          })
          offsetRef.current = offset + newChats.length
        }
        setHasMore((offset + newChats.length) < total)
      }
    } catch (err) {
      console.error('Failed to fetch chats', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDevices, filterUnread, debouncedSearch, filterHasReaction, reactionFromMe, reactionEmojis, reactionRange, reactionCustomFrom, reactionCustomTo])

  const loadMoreChats = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchChats(false)
  }, [loadingMore, hasMore, fetchChats])

  const handleChatListScroll = useCallback(() => {
    const el = chatListRef.current
    if (!el || !hasMore || loadingMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      loadMoreChats()
    }
  }, [hasMore, loadingMore, loadMoreChats])

  const fetchDevices = useCallback(async () => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/devices', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setDevices(data.devices || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchChats()
    fetchDevices()
  }, [fetchChats, fetchDevices])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Auto-open handling
  useEffect(() => {
    if (autoOpenProcessedRef.current) return
    const params = new URLSearchParams(window.location.search)
    const openChatId = params.get('open')
    const jid = params.get('jid')
    const deviceId = params.get('device')

    if (openChatId) {
      const chat = chats.find(c => c.id === openChatId)
      if (chat) {
        setSelectedChat(chat)
        autoOpenProcessedRef.current = true
        window.history.replaceState({}, '', '/dashboard/chats')
      } else if (chats.length > 0) {
        // Fetch specific chat if not in list
        const token = localStorage.getItem('token')
        fetch(`/api/chats/${openChatId}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.chat) {
               setSelectedChat(data.chat)
               autoOpenProcessedRef.current = true
               window.history.replaceState({}, '', '/dashboard/chats')
            }
          })
      }
    } else if (jid && deviceId) {
       // Search by JID logic simplified for brevity, similar to original
       const chat = chats.find(c => c.jid === jid && c.device_id === deviceId)
       if (chat) {
          setSelectedChat(chat)
          autoOpenProcessedRef.current = true
          window.history.replaceState({}, '', '/dashboard/chats')
       }
    }
  }, [chats, fetchChats])

  // WebSocket for List Updates
  useEffect(() => {
    const unsubscribe = subscribeWebSocket((data: unknown) => {
      const msg = data as { event?: string }
      if (msg.event && ['new_message', 'message_sent'].includes(msg.event)) {
        fetchChats()
      }
    })
    return () => unsubscribe()
  }, [fetchChats])

  // Resize Handlers
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = 'left'
    startXRef.current = e.clientX
    startWidthRef.current = leftPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const startRightResize = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = 'right'
    startXRef.current = e.clientX
    startWidthRef.current = rightPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingRef.current === 'left') {
        const delta = e.clientX - startXRef.current
        setLeftPanelWidth(Math.min(600, Math.max(260, startWidthRef.current + delta)))
      } else if (resizingRef.current === 'right') {
        const delta = startXRef.current - e.clientX
        setRightPanelWidth(Math.min(600, Math.max(280, startWidthRef.current + delta)))
      }
    }
    const handleMouseUp = () => {
      resizingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Selection Logic (Simplified)
  const toggleChatSelection = (chatId: string) => {
    const newSelected = new Set(selectedChats)
    if (newSelected.has(chatId)) newSelected.delete(chatId)
    else newSelected.add(chatId)
    setSelectedChats(newSelected)
  }

  const toggleSelectAll = () => {
     if (selectedChats.size === chats.length) setSelectedChats(new Set())
     else setSelectedChats(new Set(chats.map(c => c.id)))
  }

  const deleteSelectedChats = async () => {
    if (!confirm(`¿Eliminar ${selectedChats.size} chats?`)) return
    setDeleting(true)
    const token = localStorage.getItem('token')
    try {
        await fetch('/api/chats/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: Array.from(selectedChats) })
        })
        setSelectedChats(new Set())
        setSelectionMode(false)
        if (selectedChat && selectedChats.has(selectedChat.id)) setSelectedChat(null)
        fetchChats()
    } catch (e) {
        console.error(e)
        alert('Error al eliminar chats')
    } finally {
        setDeleting(false)
    }
  }

  const handleChatCreated = (chatId: string) => {
    fetchChats()
    setTimeout(() => {
        // Optimistically select new chat
        const token = localStorage.getItem('token')
        fetch(`/api/chats/${chatId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
            if (data.success && data.chat) setSelectedChat(data.chat)
        })
    }, 500)
  }

  return (
    <div className="flex-1 min-h-0 flex bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar - Chat List */}
      <div
        className={`border-r border-[#d1d7db] bg-white flex flex-col min-h-0 overflow-hidden shrink-0 ${selectedChat ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}
        style={isMdScreen ? { width: leftPanelWidth } : undefined}
      >
         <div className="border-b border-[#e9edef] bg-white">
            {/* Header / Selection Mode */}
            {selectionMode ? (
                <div className="h-[59px] px-5 flex items-center justify-between bg-[#f0f2f5]">
                    <div className="flex items-center gap-2">
                <button onClick={() => { setSelectionMode(false); setSelectedChats(new Set()) }} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        <span className="text-sm font-medium text-[#111b21]">{selectedChats.size} seleccionados</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                <button onClick={toggleSelectAll} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full transition-colors"><CheckSquare className="w-5 h-5" /></button>
                <button onClick={deleteSelectedChats} disabled={deleting || selectedChats.size === 0} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"><Trash2 className="w-5 h-5" /></button>
                    </div>
                </div>
            ) : (
                <div className="h-[59px] px-5 flex items-center gap-3 bg-[#f0f2f5]">
                    <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold shadow-sm">
                      K
                    </div>
                    <h1 className="text-[21px] font-semibold text-[#111b21] tracking-[-0.01em]">Kiri</h1>
                    <div className="flex-1" />
                    <DeviceSelector
                        devices={devices}
                        selectedDeviceIds={filterDevices}
                        onDeviceChange={setFilterDevices}
                    />
                    <button onClick={() => setShowNewChatModal(true)} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full transition-colors" title="Nuevo chat">
                        <Plus className="w-5 h-5" />
                    </button>
                    <button onClick={() => setSelectionMode(true)} className="p-2 text-[#54656f] hover:bg-black/5 rounded-full transition-colors" title="Seleccionar chats">
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Search */}
             <div className="px-4 pt-3 pb-2 bg-white">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667781]" />
                <input
                type="text"
                placeholder="Buscar un chat o iniciar uno nuevo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-11 pr-4 bg-[#f0f2f5] border-0 rounded-full text-[15px] text-[#111b21] focus:bg-[#f0f2f5] focus:ring-0 outline-none transition placeholder:text-[#667781]"
                />
              </div>
            </div>

              {/* Quick filters */}
              <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => {
                    setFilterUnread(false)
                    setFilterHasReaction(false)
                  }}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ${
                    !filterUnread && !filterHasReaction
                      ? 'bg-[#e7fce3] text-[#008069] border-[#d9fdd3]'
                      : 'bg-white text-[#54656f] border-[#d1d7db] hover:bg-[#f5f6f6]'
                  }`}
                >
                  Todos
                </button>
                <button
                    onClick={() => setFilterUnread(!filterUnread)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition ${
                        filterUnread
                            ? 'bg-[#e7fce3] text-[#008069] border-[#d9fdd3]'
                            : 'bg-white text-[#54656f] border-[#d1d7db] hover:bg-[#f5f6f6]'
                    }`}
                >
                    No leídos
                </button>
                <button className="shrink-0 px-4 py-2 rounded-full text-sm font-medium border bg-white text-[#54656f] border-[#d1d7db] hover:bg-[#f5f6f6]">
                  Favoritos
                </button>
                <button className="shrink-0 px-4 py-2 rounded-full text-sm font-medium border bg-white text-[#54656f] border-[#d1d7db] hover:bg-[#f5f6f6]">
                  Grupos
                </button>
                <button
                    data-testid="filter-reaction-toggle"
                    onClick={() => setFilterHasReaction(!filterHasReaction)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition ${
                        filterHasReaction
                      ? 'bg-[#e7fce3] text-[#008069] border-[#d9fdd3]'
                            : 'bg-white text-[#54656f] border-[#d1d7db] hover:bg-[#f5f6f6]'
                    }`}
                    title="Filtrar chats con reacciones"
                >
                  <Tag className="w-3.5 h-3.5" />
                    Etiquetas
                </button>
            </div>

            {/* Reaction advanced panel */}
            {filterHasReaction && (
                <div data-testid="filter-reaction-advanced" className="mx-4 mb-3 rounded-xl border border-[#d9fdd3] bg-[#f0fdf4] p-2.5 space-y-2">
                    <button
                        onClick={() => setShowReactionAdvanced(!showReactionAdvanced)}
                    className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-emerald-700 hover:text-emerald-800 transition-colors"
                    >
                        <span className="flex items-center gap-1.5">
                      <Heart className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                            Opciones de reacción
                        </span>
                        {showReactionAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showReactionAdvanced && (
                        <div className="space-y-2.5 pt-1">
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase tracking-wide">¿De quién?</label>
                                <div className="flex gap-1">
                                    {([
                                        { v: 'client' as const, label: 'Cliente' },
                                        { v: 'me' as const, label: 'Operador' },
                                        { v: 'any' as const, label: 'Cualquiera' },
                                    ]).map(opt => (
                                        <button
                                            key={opt.v}
                                            data-testid={`reaction-from-${opt.v}`}
                                            onClick={() => setReactionFromMe(opt.v)}
                                            className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-all ${
                                                reactionFromMe === opt.v
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-slate-800'
                                            }`}
                                        >{opt.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase tracking-wide">Emojis (opcional)</label>
                                <div className="flex flex-wrap gap-1">
                                    {['👍','❤️','😂','😮','😢','🙏','🔥'].map(e => {
                                        const active = reactionEmojis.includes(e)
                                        return (
                                            <button
                                                key={e}
                                                data-testid={`reaction-emoji-${e}`}
                                                onClick={() => setReactionEmojis(active ? reactionEmojis.filter(x => x !== e) : [...reactionEmojis, e])}
                                                className={`w-7 h-7 flex items-center justify-center rounded-md border text-sm transition-all ${
                                                  active ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:border-emerald-300'
                                                }`}
                                            >{e}</button>
                                        )
                                    })}
                                    {reactionEmojis.length > 0 && (
                                        <button
                                            data-testid="reaction-emoji-clear"
                                            onClick={() => setReactionEmojis([])}
                                            className="px-2 h-7 text-[10px] text-slate-500 hover:text-emerald-700 transition-colors"
                                        >limpiar</button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase tracking-wide">Cuándo</label>
                                <div className="flex flex-wrap gap-1">
                                    {([
                                        { v: '1d' as const, label: 'Hoy' },
                                        { v: '7d' as const, label: '7 días' },
                                        { v: '30d' as const, label: '30 días' },
                                        { v: 'any' as const, label: 'Siempre' },
                                        { v: 'custom' as const, label: 'Rango' },
                                    ]).map(opt => (
                                        <button
                                            key={opt.v}
                                            data-testid={`reaction-range-${opt.v}`}
                                            onClick={() => setReactionRange(opt.v)}
                                            className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-all ${
                                                reactionRange === opt.v
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-slate-800'
                                            }`}
                                        >{opt.label}</button>
                                    ))}
                                </div>
                                {reactionRange === 'custom' && (
                                    <div className="mt-1.5 flex gap-1.5">
                                        <input
                                            type="date"
                                            value={reactionCustomFrom}
                                            onChange={e => setReactionCustomFrom(e.target.value)}
                                            className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                                        />
                                        <input
                                            type="date"
                                            value={reactionCustomTo}
                                            onChange={e => setReactionCustomTo(e.target.value)}
                                            className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
         </div>

         {/* Chat List Items */}
         <div ref={chatListRef} onScroll={handleChatListScroll} className="flex-1 overflow-y-auto">
            {loading ? (
            <div className="p-3 space-y-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-slate-100" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                    <div className="h-3 w-full rounded bg-slate-100" />
                    <div className="h-2.5 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
            ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">No se encontraron chats</h3>
              <p className="text-xs leading-5 text-slate-500 max-w-[220px]">Prueba con otra búsqueda o desactiva algún filtro para ampliar los resultados.</p>
            </div>
            ) : (
                <>
                <button className="w-full h-[52px] px-7 flex items-center gap-5 text-left hover:bg-[#f5f6f6] transition-colors border-b border-[#f0f2f5]">
                  <Archive className="w-5 h-5 text-[#54656f]" />
                  <span className="text-[17px] text-[#3b4a54]">Archivados</span>
                </button>
                <div style={{ height: chatVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {chatVirtualizer.getVirtualItems().map(virtualRow => {
                    const chat = chats[virtualRow.index]
                    if (!chat) return null
                    return (
                    <div
                        key={chat.id}
                        ref={chatVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                        onContextMenu={(e) => { e.preventDefault(); setSelectionMode(true); toggleChatSelection(chat.id) }}
                        onClick={() => {
                            if (selectionMode) toggleChatSelection(chat.id)
                            else setSelectedChat(chat)
                        }}
                        className={`group min-h-[72px] px-4 py-2 flex items-center gap-3 cursor-pointer border-b transition-colors duration-150 relative ${selectedChat?.id === chat.id ? 'bg-[#f0f2f5] border-[#f0f2f5]' : 'border-[#f0f2f5] hover:bg-[#f5f6f6]'}`}
                    >
                        {selectionMode && (
                             <div className={`shrink-0 mt-2 ${selectedChats.has(chat.id) ? 'text-emerald-600' : 'text-slate-300'}`}>
                                 {selectedChats.has(chat.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                             </div>
                        )}

                        <div className="relative shrink-0">
                             {chat.contact_avatar_url ? (
                              <img src={chat.contact_avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
                             ) : null}
                            <div className={`w-12 h-12 bg-[#dfe5e7] rounded-full flex items-center justify-center ${chat.contact_avatar_url ? 'hidden' : ''}`}>
                                <span className="text-[#54656f] font-semibold text-lg">{getChatDisplayName(chat).charAt(0).toUpperCase()}</span>
                             </div>
                             {chat.unread_count > 0 && (
                              <div className="absolute -top-0.5 -right-0.5 bg-[#25d366] text-white text-[11px] font-bold h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center ring-2 ring-white tabular-nums">
                                    {chat.unread_count}
                                </div>
                             )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5 gap-2">
                                <h3 className={`text-[17px] leading-6 truncate pr-2 ${chat.unread_count > 0 ? 'font-semibold text-[#111b21]' : 'font-normal text-[#111b21]'}`}>
                                    {getChatDisplayName(chat)}
                                </h3>
                                <span className={`text-xs whitespace-nowrap ${chat.unread_count > 0 ? 'text-[#00a884] font-semibold' : 'text-[#667781]'}`}>
                                    {formatTime(chat.last_message_at)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              {chat.last_message && <CheckCheck className="w-4 h-4 text-[#53bdeb] shrink-0" />}
                              <span className={`text-sm truncate block ${chat.unread_count > 0 ? 'font-medium text-[#111b21]' : 'text-[#667781]'}`}>
                                    {chat.last_message || 'Sin mensajes'}
                                </span>
                            </div>
                            {/* Device & Phone Labels */}
                            <div className="flex items-center gap-2 mt-1">
                                 {chat.device_name && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f0f2f5] text-[#667781] max-w-[120px] truncate">
                                        {chat.device_name}
                                    </span>
                                 )}
                                 {formatPhone(chat.jid, chat.contact_phone) && formatPhone(chat.jid, chat.contact_phone) !== getChatDisplayName(chat) && (
                                    <span className="text-[10px] text-slate-400 truncate">
                                        {formatPhone(chat.jid, chat.contact_phone)}
                                    </span>
                                 )}
                                 {chat.lead_is_blocked && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">
                                        <ShieldBan className="w-3 h-3" />
                                        Bloqueado
                                    </span>
                                 )}
                            </div>
                        </div>
                    </div>
                    )
                })}
                </div>
                </>
            )}
            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-200 border-t-emerald-600" />
              </div>
            )}
            {!hasMore && chats.length > 0 && totalChats > CHATS_PAGE_SIZE && (
              <div className="text-center py-3 text-[11px] text-slate-400">
                {totalChats} chats cargados
              </div>
            )}
         </div>
      </div>

      {/* Resizer */}
      {isMdScreen && (
        <div
            onMouseDown={startResize}
            className="hidden md:flex w-px hover:w-1 bg-[#d1d7db] hover:bg-[#00a884]/40 cursor-col-resize shrink-0 transition-all z-10"
        />
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#f0f2f5] relative overflow-hidden">
        {selectedChat ? (
            <ChatPanel
                chatId={selectedChat.id}
                deviceId={selectedChat.device_id || devices[0]?.id || ''}
                initialChat={selectedChat}
                onClose={() => { setSelectedChat(null); setShowContactInfo(false) }}
                {...(isMdScreen ? { onContactInfoToggle: setShowContactInfo, contactInfoOpen: showContactInfo } : {})}
            />
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#667781] bg-[#f0f2f5] border-b-4 border-[#25d366]">
                <div className="w-20 h-20 bg-[#d9fdd3] rounded-full flex items-center justify-center mb-6">
                    <MessageCircle className="w-10 h-10 text-[#008069]" />
                </div>
                <h2 className="text-[28px] font-light text-[#41525d] mb-2">Kiri Web</h2>
                <p className="text-sm max-w-md">Selecciona un chat para continuar la conversación con la misma fluidez de WhatsApp.</p>
            </div>
        )}
      </div>

      {/* Right Resizer + Contact Panel (3rd column) */}
      {isMdScreen && showContactInfo && selectedChat && (
        <>
          <div
            onMouseDown={startRightResize}
            className="w-px hover:w-1 bg-[#d1d7db] hover:bg-[#00a884]/40 cursor-col-resize shrink-0 transition-all z-10"
          />
          <div className="shrink-0 overflow-hidden border-l border-slate-200" style={{ width: rightPanelWidth }}>
            <ContactPanel
              chatId={selectedChat.id}
              isOpen={true}
              onClose={() => setShowContactInfo(false)}
            />
          </div>
        </>
      )}

       <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onChatCreated={handleChatCreated}
        devices={devices}
      />
    </div>
  )
}
