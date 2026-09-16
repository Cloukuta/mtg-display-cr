type BrandLogoProps = {
  compact?: boolean;
  href?: string;
  className?: string;
};

export default function BrandLogo({
  compact = false,
  href = "/dashboard",
  className = "",
}: BrandLogoProps) {
  return (
    <a
      href={href}
      aria-label="MTG Display CR"
      className={`inline-flex items-center gap-3 ${className}`}
    >
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0"
      />

      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
            MTG
          </span>

          <span className="font-serif text-[17px] font-bold text-foreground">
            Display CR
          </span>
        </div>
      )}
    </a>
  );
}