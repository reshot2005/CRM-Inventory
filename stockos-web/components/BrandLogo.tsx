/** StockOS wordmark + mark for nav and chrome */
export function BrandLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small local SVG
    <img src="/logo.svg" alt="StockOS" className={`shrink-0 ${className}`} width={28} height={28} decoding="async" />
  );
}
