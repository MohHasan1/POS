'use client'

import { Menu } from '@base-ui/react/menu'
import {
  Boxes,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  Columns3,
  Ellipsis,
  FileText,
  History,
  ReceiptText,
  ReceiptCent,
  Settings,
  ShoppingCart,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { Dictionary } from '@/lib/localization'
import { marketSupports, type MarketProfile } from '@/lib/market'
import { cn } from '@/lib/utils'

type NavigationItem = {
  href: string
  icon: typeof ShoppingCart
  label: string
}

const baseLinkClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PrimaryNavigation({
  dictionary,
  marketConfigured,
  marketProfile,
}: {
  dictionary: Dictionary
  marketConfigured: boolean
  marketProfile: MarketProfile
}) {
  const pathname = usePathname()
  const primaryItems: Array<NavigationItem & { style: 'checkout' | 'neutral' | 'service' | 'voucher' }> = [
    { href: '/checkout', icon: ShoppingCart, label: dictionary.checkout, style: 'checkout' },
    {
      href: '/service-board',
      icon: Columns3,
      label: dictionary.serviceBoard,
      style: 'service',
    },
    {
      href: '/receipt-vouchers',
      icon: ReceiptText,
      label: dictionary.receiptVouchers,
      style: 'voucher',
    },
    { href: '/payroll', icon: WalletCards, label: dictionary.payroll, style: 'neutral' },
  ]
  const manageItems: NavigationItem[] = [
    { href: '/reports', icon: ChartNoAxesCombined, label: dictionary.reports },
    { href: '/expenses', icon: ReceiptCent, label: dictionary.expenses },
    { href: '/invoices', icon: FileText, label: dictionary.invoices },
    { href: '/products', icon: Boxes, label: dictionary.products },
    { href: '/employees', icon: UsersRound, label: dictionary.employees },
    ...(marketSupports(marketProfile, 'historicalSales')
      ? [{ href: '/historical-sales', icon: History, label: dictionary.recordPastSale }]
      : []),
  ]
  const standaloneItems: NavigationItem[] = [
    { href: '/business', icon: Building2, label: dictionary.businessInformation },
    { href: '/settings', icon: Settings, label: dictionary.settings },
  ]

  if (!marketConfigured) {
    const item = standaloneItems[0]
    return (
      <nav aria-label="Primary" className="ml-auto flex items-center">
        <Link
          href={item.href}
          aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
          className={cn(
            baseLinkClass,
            isActivePath(pathname, item.href)
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <item.icon className="size-4" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      </nav>
    )
  }

  const manageActive = manageItems.some((item) => isActivePath(pathname, item.href))

  return (
    <nav aria-label="Primary" className="ml-auto flex min-w-0 items-center gap-1">
      {primaryItems.map(({ href, icon: Icon, label, style }) => {
        const active = isActivePath(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            title={label}
            className={cn(
              baseLinkClass,
              style === 'checkout' &&
                'border border-emerald-700 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:border-emerald-400 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400',
              style === 'service' &&
                'border border-violet-600 bg-violet-500 text-white shadow-sm hover:bg-violet-600 dark:border-violet-300 dark:bg-violet-400 dark:text-violet-950 dark:hover:bg-violet-300',
              style === 'voucher' &&
                'bg-amber-100 text-amber-950 shadow-sm hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900',
              style === 'neutral' &&
                (active
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'),
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        )
      })}

      <Menu.Root>
        <Menu.Trigger
          aria-label={dictionary.manage}
          title={dictionary.manage}
          className={cn(
            baseLinkClass,
            manageActive
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Ellipsis className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">{dictionary.manage}</span>
          <ChevronDown className="hidden size-3 lg:block" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
            <Menu.Popup className="min-w-56 origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              {manageItems.map(({ href, icon: Icon, label }) => (
                <Menu.LinkItem
                  key={href}
                  closeOnClick
                  render={<Link href={href} />}
                  aria-current={isActivePath(pathname, href) ? 'page' : undefined}
                  className="flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-highlighted:text-foreground"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {label}
                </Menu.LinkItem>
              ))}
              <Menu.Separator className="my-1 h-px bg-border sm:hidden" />
              {standaloneItems.map(({ href, icon: Icon, label }) => (
                <Menu.LinkItem
                  key={href}
                  closeOnClick
                  render={<Link href={href} />}
                  aria-current={isActivePath(pathname, href) ? 'page' : undefined}
                  className="flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-highlighted:text-foreground sm:hidden"
                >
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  {label}
                </Menu.LinkItem>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {standaloneItems.map(({ href, icon: Icon, label }) => {
        const active = isActivePath(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            title={label}
            className={cn(
              baseLinkClass,
              'hidden sm:inline-flex',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
