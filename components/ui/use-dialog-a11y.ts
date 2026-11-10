"use client"

import * as React from "react"

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Dialog keyboard behaviour for hand-built modals: focus moves into the dialog when it opens,
 * Escape closes it, Tab stays inside it, and focus returns to the trigger when it closes.
 * The dialog element should have role="dialog", aria-modal and tabIndex={-1}.
 * Keys pressed in a layer on top (e.g. a confirmation dialog) are ignored.
 */
export function useDialogA11y(ref: React.RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  })

  React.useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    node.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Node | null
      // Only react to keys pressed inside this dialog (or on the page body right after opening).
      if (target && target !== document.body && !node.contains(target)) return
      if (event.key === "Escape") {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [active, ref])
}
