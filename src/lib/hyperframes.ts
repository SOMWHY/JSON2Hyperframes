/**
 * Thin wrapper around the hyperframes CLI (spawned via npx).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './generate.js';

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function requireOutputDir(): string {
  const outDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('✗ No composition found in output/.');
    console.error('  Run "j2hf generate" first.');
    process.exit(1);
  }
  return outDir;
}

/** Run `npx hyperframes <args>` in cwd, inheriting stdio. Resolves with the exit code. */
export function runHyperframes(args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // NOTE: the literal 'hyperframes' package name MUST be the first token after
    // npx/npx.cmd — it is the package npx looks up, the rest are its args.
    const cmd = [NPX, 'hyperframes', ...args].join(' ');
    const child = spawn(cmd, {
      cwd,
      stdio: 'inherit',
      shell: true
    });
    child.on('error', reject);
    child.on('close', code => resolve(code ?? 0));
  });
}

function readSettings(): any {
  const configPath = path.resolve(process.cwd(), 'video-config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return loadConfig(configPath).renderSettings || {};
  } catch {
    return {};
  }
}

export async function runCheck() {
  const outDir = requireOutputDir();
  const code = await runHyperframes(['check'], outDir);
  process.exit(code);
}

export async function runPreview(forceNew: boolean) {
  const outDir = requireOutputDir();
  const args = ['preview'];
  if (forceNew) args.push('--force-new');
  const code = await runHyperframes(args, outDir);
  process.exit(code);
}

export async function runRender(outputName?: string) {
  const outDir = requireOutputDir();
  const settings = readSettings();
  const fileName = path.basename(outputName || settings.output || 'out.mp4');

  const args = ['render', '--output', fileName];
  if (settings.quality) args.push('--quality', settings.quality);
  if (settings.fps) args.push('--fps', String(settings.fps));
  if (settings.strict) args.push('--strict');

  const code = await runHyperframes(args, outDir);
  if (code !== 0) {
    console.error(`✗ hyperframes render exited with code ${code}`);
    process.exit(code);
  }

  const produced = path.join(outDir, fileName);
  if (!fs.existsSync(produced)) {
    console.error(`✗ Render finished but ${fileName} was not found in output/.`);
    process.exit(1);
  }

  const videosDir = path.resolve(process.cwd(), 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const target = path.join(videosDir, fileName);
  fs.renameSync(produced, target);

  console.log(`✅ Rendered: ${path.relative(process.cwd(), target)}`);
}
