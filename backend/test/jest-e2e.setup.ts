// Runs before any test module (and therefore before AppModule/ConfigModule)
// loads, so NODE_ENV=test is already set by the time the app reads it.
process.env.NODE_ENV = 'test';
// Keep e2e output readable — the structured request logs are correct but
// drown out Jest's own pass/fail reporting otherwise.
process.env.LOG_LEVEL = 'silent';
