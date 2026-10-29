export type ClientAnnouncement = {
  id: string
  title: string
  body: string
  level: 'info' | 'warning'
  target: 'all' | 'client'
  clientId: string | null
  expiresAt: string | null
  active: boolean
  createdAt: string
}
export function announcementIsVisible(notice: ClientAnnouncement, clientId: string, now = Date.now()): boolean {
  return notice.active && (notice.target === 'all' || notice.clientId === clientId) &&
    (!notice.expiresAt || Number.isFinite(Date.parse(notice.expiresAt)) && Date.parse(notice.expiresAt) > now)
}
