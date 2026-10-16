"use client"

import * as React from "react"

/** Keep opened content mounted so closing can animate and nested state survives. */
export function AnimatedDisclosure({
  open, id, children,
}: { open: boolean; id: string; children: React.ReactNode }) {
  const [hasOpened, setHasOpened] = React.useState(open)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const isOwnHeightTransition = (event: React.TransitionEvent<HTMLDivElement>) =>
    event.target === event.currentTarget && event.propertyName === "grid-template-rows"

  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      onTransitionRun={event => {
        if (!isOwnHeightTransition(event)) return
        setHasOpened(true)
        setIsAnimating(true)
      }}
      onTransitionEnd={event => {
        if (isOwnHeightTransition(event)) setIsAnimating(false)
      }}
      onTransitionCancel={event => {
        if (isOwnHeightTransition(event)) setIsAnimating(false)
      }}
    >
      <div className={`min-h-0 ${open && !isAnimating ? "overflow-visible" : "overflow-hidden"}`}>
        {(open || hasOpened) && children}
      </div>
    </div>
  )
}
