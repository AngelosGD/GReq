interface Props {
  className?: string
  size?: number
}

export function Logo({ className = '', size = 28 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={className}
      aria-label="GReq logo"
    >
      <rect width="28" height="28" rx="6" fill="white" stroke="#18181b" strokeWidth="1.5" />
      <circle cx="9" cy="14" r="3.5" fill="#18181b" />
      <circle cx="19" cy="10" r="3.5" fill="#18181b" />
      <circle cx="19" cy="18" r="3.5" fill="#18181b" />
      <line x1="12" y1="14" x2="16" y2="10" stroke="#18181b" strokeWidth="1.5" />
      <line x1="12" y1="14" x2="16" y2="18" stroke="#18181b" strokeWidth="1.5" />
    </svg>
  )
}
