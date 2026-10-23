import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';
import { assertProductionEnvironment } from './production-env';

assertProductionEnvironment();
bootstrapWorker(config)
    .then(worker => worker.startJobQueue())
    .catch(err => {
        console.log(err);
    });
