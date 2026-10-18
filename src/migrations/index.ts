import * as migration_20261017_194746_initial from './20261017_194746_initial'
import * as migration_20261017_215421_business_information from './20261017_215421_business_information'
import * as migration_20261018_135207_business_contacts_and_logo from './20261018_135207_business_contacts_and_logo'
import * as migration_20261018_140414_receipt_vouchers from './20261018_140414_receipt_vouchers'
import * as migration_20261018_143226_receipt_voucher_status_workflow from './20261018_143226_receipt_voucher_status_workflow'
import * as migration_20261018_191417_default_vat_exclusive_products from './20261018_191417_default_vat_exclusive_products'

export const migrations = [
  {
    up: migration_20261017_194746_initial.up,
    down: migration_20261017_194746_initial.down,
    name: '20261017_194746_initial',
  },
  {
    up: migration_20261017_215421_business_information.up,
    down: migration_20261017_215421_business_information.down,
    name: '20261017_215421_business_information',
  },
  {
    up: migration_20261018_135207_business_contacts_and_logo.up,
    down: migration_20261018_135207_business_contacts_and_logo.down,
    name: '20261018_135207_business_contacts_and_logo',
  },
  {
    up: migration_20261018_140414_receipt_vouchers.up,
    down: migration_20261018_140414_receipt_vouchers.down,
    name: '20261018_140414_receipt_vouchers',
  },
  {
    up: migration_20261018_143226_receipt_voucher_status_workflow.up,
    down: migration_20261018_143226_receipt_voucher_status_workflow.down,
    name: '20261018_143226_receipt_voucher_status_workflow',
  },
  {
    up: migration_20261018_191417_default_vat_exclusive_products.up,
    down: migration_20261018_191417_default_vat_exclusive_products.down,
    name: '20261018_191417_default_vat_exclusive_products',
  },
]
