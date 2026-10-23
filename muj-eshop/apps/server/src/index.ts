import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config';
import { assertProductionEnvironment } from './production-env';

assertProductionEnvironment();
runMigrations(config)
    .then(() => bootstrap(config))
    .catch(err => {
        console.log(err);
    });
