import config from '@payload-config'
import { getPayload } from 'payload'

import { toMarketDateInput } from '@/lib/calendar'
import { getDocumentMarket } from '@/lib/market'
import type { SaleSettlementInput } from '@/lib/money-types'
import type { FinalizeInvoiceInput } from '@/lib/pos-types'
import type { Invoice, MoneyAccount, MoneyPayment } from '@/payload-types'

import { finalizeInvoice, type FinalizeInvoiceOptions } from './invoices'
import { createMoneyAccount, createMoneyPaymentInTransaction } from './money'

function relationshipId(value: { id: string } | null | string | undefined) {
  return typeof value === 'string' ? value : value?.id
}

export type FinalizedSale = {
  account?: MoneyAccount
  initialPayment?: MoneyPayment
  invoice: Invoice
}

export async function finalizeInvoiceWithSettlement(
  input: FinalizeInvoiceInput,
  options: FinalizeInvoiceOptions = {},
  settlement?: SaleSettlementInput,
): Promise<FinalizedSale> {
  if (!settlement) return { invoice: await finalizeInvoice(input, options) }

  const payload = await getPayload({ config })
  const transactionID = await payload.db.beginTransaction()
  if (transactionID === null) {
    throw new Error('The database could not start a transaction for this unpaid sale.')
  }
  const req = { payload, transactionID }

  try {
    const invoice = await finalizeInvoice(input, options, req)
    if (invoice.totalMinor < 1) throw new Error('A zero-value invoice cannot be marked unpaid.')
    if (
      settlement.initialPayment &&
      settlement.initialPayment.amountMinor >= invoice.totalMinor
    ) {
      throw new Error('Amount paid must be less than the invoice total.')
    }

    const profile = getDocumentMarket(invoice)
    const saleDate = toMarketDateInput(invoice.issuedAt, profile)
    const account = await createMoneyAccount(
      {
        direction: 'owedToUs',
        idempotencyKey: settlement.accountIdempotencyKey,
        invoiceId: invoice.id,
        kind: 'unpaidInvoice',
        personId: settlement.personId,
        recordDate: saleDate,
      },
      req,
    )
    if (
      relationshipId(account.invoice) !== invoice.id ||
      relationshipId(account.person) !== settlement.personId
    ) {
      throw new Error('The settlement key is already linked to another sale.')
    }

    const initialPayment = settlement.initialPayment
      ? await createMoneyPaymentInTransaction(
          {
            ...settlement.initialPayment,
            accountId: account.id,
            createReceiptVoucher: false,
            paymentDate: saleDate,
          },
          req,
        )
      : undefined
    if (initialPayment && relationshipId(initialPayment.account) !== account.id) {
      throw new Error('The payment key is already linked to another sale.')
    }

    await payload.db.commitTransaction(transactionID)
    return { account, initialPayment, invoice }
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
    throw error
  }
}
