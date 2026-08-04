'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Boxes, BriefcaseBusiness, ChevronLeft, ChevronRight, ClipboardCheck,
  Command, Factory, FileText, Gauge, LayoutDashboard, ListTree, Menu, Package,
  PackageCheck, ReceiptIndianRupee, Search, Settings, ShoppingCart,
  SlidersHorizontal, Truck, Users, Warehouse, X, Moon, Sun, ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, type AppRole } from '@/lib/auth/auth-context';
import { SessionUserProvider } from '@/lib/auth/session-user-context';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeQuery } from '@/lib/hooks/useRealtimeQuery';
import { queryClient } from '@/lib/query-client';
import {
  LOOKUP_KEYS,
  fetchLookupCustomers,
  fetchLookupItems,
  fetchLookupLocations,
  fetchLookupVendors,
} from '@/lib/query/lookups';
import { markNavClick } from '@/lib/perf/nav-marks';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Breadcrumbs } from '@/components/ui/enterprise';

export interface DashboardProfile {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  /** Raw Supabase organization_members.role when available. */
  orgRole?: string | null;
  status: string;
  allowedLocations: string[];
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: AppRole;
  adminOnly?: boolean;
  managerPlus?: boolean;
}

interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Inventory', items: [
    { href: '/dashboard/products', label: 'Products & SKUs', icon: Package },
    { href: '/dashboard/finished-goods', label: 'Finished goods', icon: Package },
    { href: '/dashboard/raw-materials', label: 'Raw materials', icon: Boxes },
    { href: '/dashboard/packaging', label: 'Packaging', icon: Package },
    { href: '/dashboard/adjustments', label: 'Adjustments', icon: SlidersHorizontal },
    { href: '/dashboard/batches', label: 'Batches & expiry (placeholder)', icon: ClipboardCheck },
  ] },
  { label: 'Orders', items: [
    { href: '/dashboard/purchase-orders', label: 'Purchase orders', icon: ShoppingCart },
    { href: '/dashboard/receive', label: 'Receive stock', icon: PackageCheck },
    { href: '/dashboard/sales', label: 'Sales orders', icon: ReceiptIndianRupee, managerPlus: true },
    { href: '/dashboard/move-orders', label: 'Move orders', icon: Truck, minRole: 'STAFF' },
    { href: '/dashboard/challans', label: 'Delivery challans', icon: FileText, managerPlus: true },
  ] },
  { label: 'Production', items: [
    { href: '/dashboard/production', label: 'Manufacturing', icon: Factory, managerPlus: true },
    { href: '/dashboard/boms', label: 'BOMs', icon: ListTree, managerPlus: true },
    // Machines & labour logging live inside Production drawers — no standalone stubs.
    { href: '/dashboard/qa', label: 'Quality assurance (placeholder)', icon: ClipboardCheck },
  ] },
  { label: 'People', items: [
    { href: '/dashboard/vendors', label: 'Vendors', icon: BriefcaseBusiness },
    { href: '/dashboard/customers', label: 'Customers', icon: Users },
  ] },
  { label: 'Finance', items: [
    { href: '/dashboard/invoices', label: 'Invoices (placeholder)', icon: ReceiptIndianRupee, managerPlus: true },
    { href: '/dashboard/reports', label: 'Reports', icon: Gauge },
  ] },
  { label: 'Administration', items: [
    { href: '/dashboard/admin/locations', label: 'Locations', icon: Warehouse, adminOnly: true },
    { href: '/dashboard/admin/users', label: 'Users & access', icon: Users, adminOnly: true },
    { href: '/dashboard/delivery-types', label: 'Delivery types (placeholder)', icon: Truck, adminOnly: true },
    { href: '/dashboard/settings/team', label: 'Team & Roles', icon: Users, adminOnly: true },
    { href: '/dashboard/settings/audit-log', label: 'Audit log', icon: ScrollText, adminOnly: true },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ] },
];

function roleRank(r: AppRole): number {
  const order: AppRole[] = ['VIEWER', 'STAFF', 'MANAGER', 'ADMIN'];
  return order.indexOf(r);
}

function navVisible(item: NavItem, role: AppRole): boolean {
  // OWNER is mapped to ADMIN in layout — treat ADMIN as full access.
  if (item.adminOnly) return role === 'ADMIN';
  if (item.managerPlus) {
    return role === 'ADMIN' || role === 'MANAGER';
  }
  if (item.minRole) {
    return roleRank(role) >= roleRank(item.minRole);
  }
  return true;
}

export function DashboardLayoutClient({
  profile,
  children,
}: {
  profile: DashboardProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    return () => document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const badgesEnabled = pathname.includes('/move-orders');

  const { data: pendingMoveOrders } = useRealtimeQuery<number>(
    ['layout-pending-moves', profile.id],
    'move_orders',
    async () => {
      const { count } = await supabase
        .from('move_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['DRAFT', 'PENDING', 'IN_TRANSIT']);
      return count ?? 0;
    },
    badgesEnabled,
  );

  function prefetchLookups() {
    void queryClient.prefetchQuery({
      queryKey: [...LOOKUP_KEYS.items],
      queryFn: fetchLookupItems,
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: [...LOOKUP_KEYS.locations],
      queryFn: fetchLookupLocations,
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: [...LOOKUP_KEYS.vendors],
      queryFn: fetchLookupVendors,
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: [...LOOKUP_KEYS.customers],
      queryFn: fetchLookupCustomers,
      staleTime: 60_000,
    });
  }

  async function onSignOut() {
    await signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  const crumbs = pathname.split('/').filter(Boolean).map((segment, index, all) => ({
    label: segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: index === all.length - 1 ? undefined : `/${all.slice(0, index + 1).join('/')}`,
  }));

  const renderNavigation = (isMobile = false) => (
    <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => navVisible(item, profile.role));
        if (!items.length) return null;
        return (
          <section key={group.label}>
            <p className={`mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/45 ${collapsed && !isMobile ? 'sr-only' : ''}`}>{group.label}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                const pending = item.href === '/dashboard/move-orders' ? (pendingMoveOrders ?? 0) : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      markNavClick(item.href);
                      setMobileOpen(false);
                    }}
                    onMouseEnter={prefetchLookups}
                    onFocus={prefetchLookups}
                    title={collapsed && !isMobile ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'} ${collapsed && !isMobile ? 'justify-center px-2' : ''}`}
                  >
                    {active ? <span className="absolute -left-3 h-5 w-0.5 rounded-full bg-primary" /> : null}
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className={collapsed && !isMobile ? 'sr-only' : 'truncate'}>{item.label}</span>
                    {pending > 0 && !(collapsed && !isMobile) ? <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{pending > 99 ? '99+' : pending}</span> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );

  return (
    <SessionUserProvider
      value={{
        userId: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        status: profile.status,
      }}
    >
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 lg:flex ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className={`flex h-16 items-center border-b border-sidebar-border px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground">S</div>
            <span className={`font-heading text-lg font-bold text-sidebar-foreground ${collapsed ? 'sr-only' : ''}`}>StockOS</span>
          </Link>
        </div>
        {renderNavigation()}
        <div className="border-t border-sidebar-border p-3">
          <div className={`mb-3 flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{profile.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className={collapsed ? 'sr-only' : 'min-w-0'}><p className="truncate text-sm font-medium text-sidebar-foreground">{profile.name}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{profile.role}</p></div>
          </div>
          <Button variant="ghost" size="sm" className={`w-full text-sidebar-foreground ${collapsed ? 'px-0' : 'justify-start'}`} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}</Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="bg-sidebar p-0">{renderNavigation(true)}</SheetContent>
      </Sheet>

      <div className={`flex min-h-screen flex-col transition-[padding] duration-300 ${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1"><Breadcrumbs items={crumbs} /></div>
          <button type="button" onClick={() => setCommandOpen(true)} className="hidden h-9 w-64 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-left text-sm text-muted-foreground hover:bg-muted md:flex"><Search className="h-4 w-4" /> Search StockOS <kbd className="ml-auto rounded border bg-card px-1.5 text-[10px]">⌘K</kbd></button>
          <NotificationBell />
          <Button variant="ghost" size="icon" aria-label="Toggle colour theme" onClick={() => setDarkMode((value) => !value)}>
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <button type="button" className="hidden rounded-full px-2 py-1 text-sm font-medium hover:bg-muted sm:block" onClick={() => void onSignOut()}>{profile.name}</button>
        </header>
        <main id="main-content" className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      {commandOpen ? <div className="fixed inset-0 z-[60] grid place-items-start bg-slate-950/35 p-4 pt-[15vh] backdrop-blur-sm" onClick={() => setCommandOpen(false)}><div role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-2 border-b border-border px-4"><Command className="h-5 w-5 text-muted-foreground" /><input autoFocus className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search pages and quick actions…" /><button onClick={() => setCommandOpen(false)} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /><span className="sr-only">Close</span></button></div><div className="p-2"><p className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>{[{ href: '/dashboard/inventory/add', label: 'Add inventory item' }, { href: '/dashboard/sales', label: 'Create sales order' }, { href: '/dashboard/vendors', label: 'Add vendor' }].map((item) => <Link key={item.href} href={item.href} onClick={() => setCommandOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{item.label}</Link>)}</div></div></div> : null}
    </div>
    </SessionUserProvider>
  );
}
