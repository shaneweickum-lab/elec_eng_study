export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 3 28 10v12L16 29 4 22V10z" fill="none" stroke="var(--cyan)" strokeWidth="1.6" />
      <path d="M16 3v26M4 10l12 7 12-7" fill="none" stroke="var(--navy)" strokeWidth="1.2" opacity="0.9" />
      <path d="M17.5 8 12 17h4l-1.5 7L20 15h-4z" fill="var(--amber)" />
    </svg>
  );
}
