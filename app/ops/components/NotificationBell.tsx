"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Bell, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Users, 
  Zap, 
  ExternalLink, 
  Check, 
  Trash2, 
  RefreshCw, 
  X,
  Radio
} from "lucide-react"
import { getOperationalNotificationsAction, OperationalNotification } from "@/app/actions/notifications"

const READ_STORAGE_KEY = "linke_notifications_read_ids_v1"
const DISMISSED_STORAGE_KEY = "linke_notifications_dismissed_ids_v1"

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 60) return "Agora mesmo"
    if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)} min`
    if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)} h`
    if (diffSec < 172800) return "Ontem"
    return `há ${Math.floor(diffSec / 86400)} dias`
  } catch {
    return "Recentemente"
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [notifications, setNotifications] = React.useState<OperationalNotification[]>([])
  const [readIds, setReadIds] = React.useState<string[]>([])
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([])
  const [filter, setFilter] = React.useState<"all" | "unread" | "alerts">("all")

  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Initialize read & dismissed IDs from localStorage
  React.useEffect(() => {
    try {
      const storedRead = localStorage.getItem(READ_STORAGE_KEY)
      if (storedRead) setReadIds(JSON.parse(storedRead))
      const storedDismissed = localStorage.getItem(DISMISSED_STORAGE_KEY)
      if (storedDismissed) setDismissedIds(JSON.parse(storedDismissed))
    } catch {}
  }, [])

  // Fetch notifications
  const fetchNotifications = React.useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const list = await getOperationalNotificationsAction()
      setNotifications(list)
    } catch (err) {
      console.error("Error loading notifications:", err)
    } finally {
      setLoading(false)
      if (isManual) {
        setTimeout(() => setRefreshing(false), 400)
      }
    }
  }, [])

  React.useEffect(() => {
    fetchNotifications()
    // Poll every 60 seconds
    const interval = setInterval(() => fetchNotifications(), 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Filter visible items
  const visibleNotifications = React.useMemo(() => {
    return notifications
      .filter((n) => !dismissedIds.includes(n.id))
      .filter((n) => {
        const isRead = readIds.includes(n.id)
        if (filter === "unread") return !isRead
        if (filter === "alerts") return n.priority === "high" || n.type === "warning" || n.type === "batch"
        return true
      })
  }, [notifications, dismissedIds, readIds, filter])

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !dismissedIds.includes(n.id) && !readIds.includes(n.id)).length
  }, [notifications, dismissedIds, readIds])

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev
      const updated = [...prev, id]
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    setReadIds(allIds)
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(allIds))
    } catch {}
  }

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissedIds((prev) => {
      const updated = [...prev, id]
      try {
        localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const handleNotificationClick = (item: OperationalNotification) => {
    markAsRead(item.id)
    setIsOpen(false)
    if (item.link) {
      router.push(item.link)
    }
  }

  const getNotificationIcon = (type: OperationalNotification["type"], priority: OperationalNotification["priority"]) => {
    switch (type) {
      case "batch":
        return <Layers className="w-4 h-4 text-amber-600" />
      case "shipment":
        return <Package className="w-4 h-4 text-emerald-600" />
      case "client":
        return <Users className="w-4 h-4 text-blue-600" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-rose-600" />
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-teal-600" />
      default:
        return <Radio className="w-4 h-4 text-emerald-600" />
    }
  }

  const getIconBg = (type: OperationalNotification["type"]) => {
    switch (type) {
      case "batch":
        return "bg-amber-100/70 border-amber-200"
      case "shipment":
        return "bg-emerald-100/70 border-emerald-200"
      case "client":
        return "bg-blue-100/70 border-blue-200"
      case "warning":
        return "bg-rose-100/70 border-rose-200"
      case "success":
        return "bg-teal-100/70 border-teal-200"
      default:
        return "bg-slate-100 border-slate-200"
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir notificações operacionais"
        className={`relative p-2.5 rounded-xl transition-all cursor-pointer ${
          isOpen
            ? "bg-emerald-50 text-emerald-700 shadow-2xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95"
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-emerald-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col font-sans">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Notificações Operacionais
                  {unreadCount > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400">Eventos em tempo real da rede Linke & CTT</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchNotifications(true)}
                title="Atualizar"
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Bar & Quick Actions */}
          <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filter === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filter === "unread" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Não Lidas ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("alerts")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  filter === "alerts" ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Alertas
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                Marcar lidas
              </button>
            )}
          </div>

          {/* Notification Items List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                <span>A carregar notificações...</span>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Sem notificações pendentes</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Tudo em dia com a sua operação logística.</p>
              </div>
            ) : (
              visibleNotifications.map((item) => {
                const isRead = readIds.includes(item.id)

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 transition-all flex items-start gap-3 cursor-pointer group ${
                      isRead ? "bg-white hover:bg-slate-50 opacity-80" : "bg-emerald-50/25 hover:bg-emerald-50/50"
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${getIconBg(item.type)}`}>
                      {getNotificationIcon(item.type, item.priority)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1 mb-0.5">
                        <span className={`text-xs truncate ${isRead ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                        {item.message}
                      </p>

                      {/* Action Button & Indicator */}
                      <div className="flex items-center justify-between mt-2">
                        {item.actionLabel && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <span>{item.actionLabel}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {!isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(item.id)
                              }}
                              title="Marcar como lida"
                              className="text-[10px] text-slate-400 hover:text-emerald-700 transition-colors p-1"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => dismissNotification(item.id, e)}
                            title="Remover"
                            className="text-[10px] text-slate-300 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Unread blue/emerald dot */}
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5 shadow-2xs" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-slate-100 bg-slate-50 text-center flex items-center justify-between text-xs">
            <span className="text-[10px] text-slate-400 font-medium">TMS Linke v1.0</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                router.push("/ops/envios")
              }}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos os envios</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
