#!/usr/bin/env node

/**
 * Fridayy CLI Binary Runner
 */

import { run } from '../dist/cli/index.js';

run().catch((err) => {
  console.error('Fridayy Error:', err);
  process.exit(1);
});
