'use client'

import {
  Boxes,
  Building2,
  ChartNoAxesCombined,
  Columns3,
  ContactRound,
  Ellipsis,
  FileText,
  HandCoins,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
  ReceiptCent,
  Settings,
  ShoppingCart,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  isActivePath,
  NavigationDropdown,
  navigationLinkClass as baseLinkClass,
  type NavigationItem,
} from '@/components/ui/navigation-dropdown'
import type { Dictionary } from '@/lib/localization'
import { marketSupports, type MarketProfile } from '@/lib/market'
import { cn } from '@/lib/utils'

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
  const primaryItems: Array<
    NavigationItem & { style: 'checkout' | 'service' | 'voucher' }
  > = [
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
  ]
  const recordsItems: NavigationItem[] = [
    { href: '/invoices', icon: FileText, label: dictionary.invoices },
    { href: '/reports', icon: ChartNoAxesCombined, label: dictionary.reports },
    { href: '/expenses', icon: ReceiptCent, label: dictionary.expenses },
    { href: '/payroll', icon: WalletCards, label: dictionary.payroll },
  ]
  const moneyItems: NavigationItem[] = [
    { href: '/money/owed-to-us', icon: ArrowDownLeft, label: dictionary.owedToUs },
    { href: '/money/we-owe', icon: ArrowUpRight, label: dictionary.weOwe },
  ]
  const manageItems: NavigationItem[] = [
    { href: '/products', icon: Boxes, label: dictionary.products },
    { href: '/employees', icon: UsersRound, label: dictionary.employees },
    { href: '/people', icon: ContactRound, label: dictionary.people },
    ...(marketSupports(marketProfile, 'historicalSales')
      ? [{ href: '/historical-sales', icon: History, label: dictionary.recordPastSale }]
      : []),
  ]
  const settingsItems: NavigationItem[] = [
    { href: '/business', icon: Building2, label: dictionary.businessInformation },
    { href: '/settings', icon: Settings, label: dictionary.settings },
  ]

  if (!marketConfigured) {
    const item = settingsItems[0]
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
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        )
      })}

      <NavigationDropdown compactIcon={HandCoins} icon={Ellipsis} items={moneyItems} label={dictionary.money} />
      <NavigationDropdown icon={Ellipsis} items={manageItems} label={dictionary.manage} />
      <NavigationDropdown icon={Ellipsis} items={recordsItems} label={dictionary.records} />
      <NavigationDropdown icon={Settings} items={settingsItems} label={dictionary.settings} />
    </nav>
  )
}
