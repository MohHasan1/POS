import * as migration_20261017_194746_initial from './20261017_194746_initial';
import * as migration_20261017_215421_business_information from './20261017_215421_business_information';

export const migrations = [
  {
    up: migration_20261017_194746_initial.up,
    down: migration_20261017_194746_initial.down,
    name: '20261017_194746_initial',
  },
  {
    up: migration_20261017_215421_business_information.up,
    down: migration_20261017_215421_business_information.down,
    name: '20261017_215421_business_information'
  },
];
