export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Sam.AI logo" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#0d9488" />
      <path d="M21.5 11.2c-.9-1.6-2.8-2.5-5-2.5-2.7 0-4.6 1.3-4.6 3.4 0 4.6 9.8 2.2 9.8 7.2 0 2.3-2.2 3.9-5.2 3.9-2.5 0-4.6-1-5.6-2.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
