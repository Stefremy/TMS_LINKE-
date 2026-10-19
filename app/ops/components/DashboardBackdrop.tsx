import styles from "./DashboardBackdrop.module.css"

/** Decorative only; CSS motion keeps the dashboard free of animation timers. */
export function DashboardBackdrop() {
  return <div className={styles.backdrop} aria-hidden="true">
    <span className={`${styles.shape} ${styles.circle}`} />
    <span className={`${styles.shape} ${styles.triangle}`} />
    <span className={`${styles.shape} ${styles.smallTriangle}`} />
    <span className={`${styles.shape} ${styles.limeCircle}`} />
    <span className={`${styles.shape} ${styles.cross}`} />
    <span className={`${styles.shape} ${styles.square}`} />
    <span className={`${styles.shape} ${styles.smallCross}`} />
  </div>
}
