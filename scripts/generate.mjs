#!/usr/bin/env node

/**
 * Thin shell — delegates to lib/generate.mjs for backward compatibility.
 *
 * Old usage:
 *   node scripts/generate.mjs                        # examples/demo.json → output/
 *   node scripts/generate.mjs path/to/config.json    # custom config
 *   node scripts/generate.mjs demo.json --output=out/  # custom output dir
 */

import { runGenerate } from '../lib/generate.mjs';

const args = process.argv.slice(2);
const configArg = args.find(a => !a.startsWith('--')) || 'examples/demo.json';
const outputFlag = args.find(a => a.startsWith('--output='));
const outputDir = outputFlag ? outputFlag.split('=')[1] || 'output' : 'output';

await runGenerate(configArg, { outputDir });