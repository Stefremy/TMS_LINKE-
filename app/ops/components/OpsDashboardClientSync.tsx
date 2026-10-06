"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export function OpsDashboardClientSync({ activeIds }: { activeIds: string[] }) {
  const router = useRouter()

  React.useEffect(() => {
    if (!activeIds || activeIds.length === 0) return

    let isMounted = true

    import("@/app/actions/shipments").then(({ syncActiveShipmentsBatchAction }) => {
      const doSync = () => {
        syncActiveShipmentsBatchAction(activeIds)
          .then((res) => {
            if (isMounted && res.updatedCount > 0) {
              router.refresh()
            }
          })
          .catch(() => {})
      }

      // Initial sync
      doSync()

      // Poll every 5 minutes but only if tab is active
      const interval = setInterval(() => {
        if (isMounted && document.visibilityState === 'visible') {
          doSync()
        }
      }, 300000)

      return () => clearInterval(interval)
    })

    return () => {
      isMounted = false
    }
  }, [activeIds.length]) // only re-run if number of active shipments changes (simplification)

  return null
}
