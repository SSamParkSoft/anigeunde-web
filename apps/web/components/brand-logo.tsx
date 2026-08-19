type BrandLogoProps = {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ inverse = false, compact = false, className = "" }: BrandLogoProps) {
  const label = compact ? "아니근데" : undefined;

  return (
    <span className={`brand-logo ${inverse ? "brand-logo-inverse" : ""} ${className}`.trim()}>
      <svg
        className="brand-mark"
        viewBox="0 0 48 48"
        role={compact ? "img" : undefined}
        aria-label={label}
        aria-hidden={compact ? undefined : true}
      >
        <rect className="brand-mark-field" width="48" height="48" rx="12" />
        <path className="brand-mark-ink" d="M9 19a10 10 0 1 1 18.5 5.25L10.2 35.6a1.6 1.6 0 0 1-2.45-1.62L9.6 26.8A9.96 9.96 0 0 1 9 19Z" />
        <circle className="brand-mark-field" cx="19" cy="19" r="4.25" />
        <rect className="brand-mark-ink" x="25" y="8" width="6" height="20" rx="3" />
        <rect className="brand-mark-ink" x="28" y="16" width="7" height="6" rx="3" />
        <rect className="brand-mark-ink" x="22" y="31" width="12" height="5.5" rx="2.75" />
        <circle className="brand-mark-ink" cx="39" cy="34" r="3.5" />
      </svg>
      {compact ? null : <span className="brand-wordmark">아니근데<span aria-hidden="true">.</span></span>}
    </span>
  );
}
