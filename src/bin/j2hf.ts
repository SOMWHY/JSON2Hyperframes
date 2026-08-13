#!/usr/bin/env node

/**
 * j2hf CLI — JSON2Hyperframes Command Line Interface
 *
 * Commands:
 *   init [projectName]     Create a new project
 *   generate [--config]    Generate HyperFrames HTML from config
 *   preview [--force-new]  Start preview server
 *   render [--output]      Render video
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const command = args[0];

// Parse flags
function getFlag(name: string): string | null {
  const flag = args.find(a => a.startsWith(`--${name}=`));
  return flag ? flag.split('=')[1] || null : null;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// Command dispatcher
async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(`j2hf — JSON2Hyperframes CLI

Usage:
  j2hf init [projectName]        Create a new project
  j2hf generate [--config=PATH]  Generate HyperFrames HTML
  j2hf preview [--force-new]     Start preview server
  j2hf render [--output=FILE]    Render video

Examples:
  j2hf init my-video
  j2hf generate
  j2hf generate --config=custom.json
  j2hf preview
  j2hf render --output=final.mp4
`);
    process.exit(0);
  }

  switch (command) {
    case 'init': {
      const { runInit } = await import('../lib/init.js');
      await runInit(args[1]);
      break;
    }

    case 'generate': {
      const { runGenerate } = await import('../lib/generate.js');
      const configPath = getFlag('config') || 'video-config.json';
      await runGenerate(configPath);
      break;
    }

    case 'preview': {
      const { runPreview } = await import('../lib/hyperframes.js');
      await runPreview(hasFlag('force-new'));
      break;
    }

    case 'render': {
      const { runRender } = await import('../lib/hyperframes.js');
      const outputPath = getFlag('output') || undefined;
      await runRender(outputPath);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "j2hf --help" for usage information');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
