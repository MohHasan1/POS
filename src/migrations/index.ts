import * as migration_20261017_194746_initial from './20261017_194746_initial';
import * as migration_20261017_215421_business_information from './20261017_215421_business_information';
import * as migration_20261018_135207_business_contacts_and_logo from './20261018_135207_business_contacts_and_logo';
import * as migration_20261018_140414_receipt_vouchers from './20261018_140414_receipt_vouchers';
import * as migration_20261018_143226_receipt_voucher_status_workflow from './20261018_143226_receipt_voucher_status_workflow';
import * as migration_20261018_191417_default_vat_exclusive_products from './20261018_191417_default_vat_exclusive_products';
import * as migration_20261117_105643_service_board_and_dashboard from './20261117_105643_service_board_and_dashboard';
import * as migration_20261117_123954_country_profiles from './20261117_123954_country_profiles';
import * as migration_20261117_132500_nullable_product_names from './20261117_132500_nullable_product_names';
import * as migration_20261118_123605_employee_assignments from './20261118_123605_employee_assignments';
import * as migration_20261118_130246_historical_sales_backfill from './20261118_130246_historical_sales_backfill';
import * as migration_20261118_180955_employee_payroll_schema from './20261118_180955_employee_payroll_schema';
import * as migration_20261119_080747_business_reports_expenses from './20261119_080747_business_reports_expenses';
import * as migration_20261123_094130_money_owed from './20261123_094130_money_owed';
import * as migration_20261124_063243_money_product_prices from './20261124_063243_money_product_prices';
import * as migration_20261124_083113_people_details from './20261124_083113_people_details';
import * as migration_20261125_174657_pos_access from './20261125_174657_pos_access';
import * as migration_20261126_064130_supplies from './20261126_064130_supplies';
import * as migration_20261126_070707_supply_usage_details from './20261126_070707_supply_usage_details';
import * as migration_20261126_080156_supply_costs from './20261126_080156_supply_costs';
import * as migration_20261127_055314_supply_stock from './20261127_055314_supply_stock';
import * as migration_20261127_092810_cash_summary from './20261127_092810_cash_summary';
import * as migration_20261127_145338_always_on_cash from './20261127_145338_always_on_cash';
import * as migration_20261127_160135_daily_cash_closing from './20261127_160135_daily_cash_closing';
import * as migration_20261128_000000_backfill_product_skus from './20261128_000000_backfill_product_skus';
import * as migration_20261128_010914_daily_cash_openings from './20261128_010914_daily_cash_openings';
import * as migration_20261128_014532_cash_for_tomorrow from './20261128_014532_cash_for_tomorrow';
import * as migration_20261128_015304_editable_cash_closing from './20261128_015304_editable_cash_closing';

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
  {
    up: migration_20261117_105643_service_board_and_dashboard.up,
    down: migration_20261117_105643_service_board_and_dashboard.down,
    name: '20261117_105643_service_board_and_dashboard',
  },
  {
    up: migration_20261117_123954_country_profiles.up,
    down: migration_20261117_123954_country_profiles.down,
    name: '20261117_123954_country_profiles',
  },
  {
    up: migration_20261117_132500_nullable_product_names.up,
    down: migration_20261117_132500_nullable_product_names.down,
    name: '20261117_132500_nullable_product_names',
  },
  {
    up: migration_20261118_123605_employee_assignments.up,
    down: migration_20261118_123605_employee_assignments.down,
    name: '20261118_123605_employee_assignments',
  },
  {
    up: migration_20261118_130246_historical_sales_backfill.up,
    down: migration_20261118_130246_historical_sales_backfill.down,
    name: '20261118_130246_historical_sales_backfill',
  },
  {
    up: migration_20261118_180955_employee_payroll_schema.up,
    down: migration_20261118_180955_employee_payroll_schema.down,
    name: '20261118_180955_employee_payroll_schema',
  },
  {
    up: migration_20261119_080747_business_reports_expenses.up,
    down: migration_20261119_080747_business_reports_expenses.down,
    name: '20261119_080747_business_reports_expenses',
  },
  {
    up: migration_20261123_094130_money_owed.up,
    down: migration_20261123_094130_money_owed.down,
    name: '20261123_094130_money_owed',
  },
  {
    up: migration_20261124_063243_money_product_prices.up,
    down: migration_20261124_063243_money_product_prices.down,
    name: '20261124_063243_money_product_prices',
  },
  {
    up: migration_20261124_083113_people_details.up,
    down: migration_20261124_083113_people_details.down,
    name: '20261124_083113_people_details',
  },
  {
    up: migration_20261125_174657_pos_access.up,
    down: migration_20261125_174657_pos_access.down,
    name: '20261125_174657_pos_access',
  },
  {
    up: migration_20261126_064130_supplies.up,
    down: migration_20261126_064130_supplies.down,
    name: '20261126_064130_supplies',
  },
  {
    up: migration_20261126_070707_supply_usage_details.up,
    down: migration_20261126_070707_supply_usage_details.down,
    name: '20261126_070707_supply_usage_details',
  },
  {
    up: migration_20261126_080156_supply_costs.up,
    down: migration_20261126_080156_supply_costs.down,
    name: '20261126_080156_supply_costs',
  },
  {
    up: migration_20261127_055314_supply_stock.up,
    down: migration_20261127_055314_supply_stock.down,
    name: '20261127_055314_supply_stock',
  },
  {
    up: migration_20261127_092810_cash_summary.up,
    down: migration_20261127_092810_cash_summary.down,
    name: '20261127_092810_cash_summary',
  },
  {
    up: migration_20261127_145338_always_on_cash.up,
    down: migration_20261127_145338_always_on_cash.down,
    name: '20261127_145338_always_on_cash',
  },
  {
    up: migration_20261127_160135_daily_cash_closing.up,
    down: migration_20261127_160135_daily_cash_closing.down,
    name: '20261127_160135_daily_cash_closing',
  },
  {
    up: migration_20261128_000000_backfill_product_skus.up,
    down: migration_20261128_000000_backfill_product_skus.down,
    name: '20261128_000000_backfill_product_skus',
  },
  {
    up: migration_20261128_010914_daily_cash_openings.up,
    down: migration_20261128_010914_daily_cash_openings.down,
    name: '20261128_010914_daily_cash_openings',
  },
  {
    up: migration_20261128_014532_cash_for_tomorrow.up,
    down: migration_20261128_014532_cash_for_tomorrow.down,
    name: '20261128_014532_cash_for_tomorrow',
  },
  {
    up: migration_20261128_015304_editable_cash_closing.up,
    down: migration_20261128_015304_editable_cash_closing.down,
    name: '20261128_015304_editable_cash_closing'
  },
];
