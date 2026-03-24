/** StockOS wordmark + mark for nav and chrome */
export function BrandLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img src="/logo.svg" alt="StockOS" className={`shrink-0 ${className}`} width={28} height={28} decoding="async" />
  );
}
