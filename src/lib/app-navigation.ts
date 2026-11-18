import {
  Boxes,
  Building2,
  Columns3,
  FileText,
  History,
  Home,
  ReceiptText,
  Settings,
  ShoppingCart,
  UsersRound,
} from 'lucide-react'

import { marketSupports, type MarketProfile } from './market'

export const appNavigation = [
  {
    href: '/',
    labelKey: 'home',
    homeLabelKey: 'home',
    homeDescriptionKey: 'welcome',
    icon: Home,
    primary: false,
  },
  {
    href: '/checkout',
    labelKey: 'checkout',
    homeLabelKey: 'startCheckout',
    homeDescriptionKey: 'homeCheckoutDescription',
    icon: ShoppingCart,
    primary: true,
  },
  {
    href: '/service-board',
    labelKey: 'serviceBoard',
    homeLabelKey: 'serviceBoard',
    homeDescriptionKey: 'homeServiceBoardDescription',
    icon: Columns3,
    primary: true,
  },
  {
    href: '/invoices',
    labelKey: 'invoices',
    homeLabelKey: 'invoiceHistory',
    homeDescriptionKey: 'homeInvoicesDescription',
    icon: FileText,
    primary: false,
  },
  {
    href: '/historical-sales',
    labelKey: 'recordPastSale',
    homeLabelKey: 'recordPastSale',
    homeDescriptionKey: 'homeHistoricalSalesDescription',
    icon: History,
    marketFeature: 'historicalSales',
    primary: false,
  },
  {
    href: '/products',
    labelKey: 'products',
    homeLabelKey: 'manageProducts',
    homeDescriptionKey: 'homeProductsDescription',
    icon: Boxes,
    primary: false,
  },
  {
    href: '/employees',
    labelKey: 'employees',
    homeLabelKey: 'manageEmployees',
    homeDescriptionKey: 'homeEmployeesDescription',
    icon: UsersRound,
    primary: false,
  },
  {
    href: '/receipt-vouchers',
    labelKey: 'receiptVouchers',
    homeLabelKey: 'receiptVouchers',
    homeDescriptionKey: 'homeReceiptVouchersDescription',
    icon: ReceiptText,
    primary: false,
  },
  {
    href: '/business',
    labelKey: 'businessInformation',
    homeLabelKey: 'businessInformation',
    homeDescriptionKey: 'homeBusinessDescription',
    icon: Building2,
    primary: false,
  },
  {
    href: '/settings',
    labelKey: 'settings',
    homeLabelKey: 'settings',
    homeDescriptionKey: 'homeSettingsDescription',
    icon: Settings,
    primary: false,
  },
] as const

export function getAppNavigation(profile: MarketProfile) {
  return appNavigation.filter(
    (item) => !('marketFeature' in item) || marketSupports(profile, item.marketFeature),
  )
}
