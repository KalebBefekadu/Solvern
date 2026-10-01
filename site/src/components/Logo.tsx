// The wordmark path lives once in public/brand/lockup-symbol.svg (generated from assets/logos/solvern-lockup.svg),
// cached by the browser instead of repeated in every page's HTML and hydration payload.
// Color comes from currentColor, which <use> passes into the symbol; forced-colors mode keeps it.
export function Lockup({ className, title = "Solvern" }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 671.6 96" width="182" height="26" role="img" aria-label={title} fill="currentColor">
      <use href="/brand/lockup-symbol.svg#lockup" />
    </svg>
  );
}

export function Mark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M16 16H80V30H30V41H51L45 55H16Z" />
      <path d="M55 41H80V80H16V66H66V55H49Z" />
    </svg>
  );
}
