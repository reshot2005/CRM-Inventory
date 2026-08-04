import Link from 'next/link';

function PreviewCard() {
  return (
    <div className="rounded-2xl bg-[hsl(222,47%,11%)] p-5 text-white w-full max-w-lg shadow-[0_40px_120px_rgba(37,99,235,0.25)]">
      <div className="flex items-center justify-between mb-4">
        <span className="font-heading font-bold text-sm">StockOS Dashboard</span>
        <span className="font-mono text-xs text-cobalt">Live · 3 Warehouses</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total SKUs', value: '1,247' },
          { label: 'Low stock', value: '18' },
          { label: 'Move orders', value: '34' },
          { label: 'POs open', value: '12' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-[hsl(215,28%,17%)] p-3"
          >
            <p className="text-xs text-slate-400 font-body">{s.label}</p>
            <p className="text-lg font-heading font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-400 font-body leading-relaxed">
        Real-time inventory, approvals, and reporting — the same experience you get after
        sign-in.
      </p>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex w-full flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:w-1/2 lg:px-16 xl:px-20 bg-[hsl(214,20%,97%)]">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-block text-sm font-body font-medium text-cobalt hover:opacity-90 transition-opacity"
          >
            ← Back to home
          </Link>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[hsl(222,47%,11%)] tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-[15px] font-body text-slate-600 leading-relaxed">
            {subtitle}
          </p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>

      <div className="relative flex min-h-[280px] w-full flex-1 flex-col justify-center overflow-hidden gradient-dark noise-overlay px-8 py-12 sm:px-12 lg:min-h-screen lg:w-1/2">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-cobalt/10 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-premium/10 blur-[90px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-xl">
          <p className="font-heading font-bold text-cobalt text-sm uppercase tracking-wider mb-4">
            StockOS
          </p>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white leading-tight mb-6">
            Your inventory, fully under control.
          </h2>
          <PreviewCard />
        </div>
      </div>
    </div>
  );
}
