/**
 * j2hf init — project scaffolding
 */

import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');

const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function nameError(name: string): string | null {
  if (!name || !name.trim()) return 'Project name cannot be empty.';
  if (!VALID_NAME.test(name)) return 'Use letters, digits, dot, dash or underscore; must start with a letter or digit.';
  if (fs.existsSync(path.resolve(process.cwd(), name))) return `Directory "${name}" already exists.`;
  return null;
}

async function askProjectName(): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    for (;;) {
      const answer = (await rl.question('Project name: ')).trim();
      const err = nameError(answer);
      if (!err) return answer;
      console.log(`  ${err}`);
    }
  } finally {
    rl.close();
  }
}

export async function runInit(argName?: string) {
  let name = argName;

  if (name) {
    const err = nameError(name);
    if (err) {
      console.error(`✗ ${err}`);
      process.exit(1);
    }
  } else {
    name = await askProjectName();
  }

  const projectDir = path.resolve(process.cwd(), name);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'output'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'videos'), { recursive: true });

  const configTemplate = fs.readFileSync(path.join(PKG_ROOT, 'templates', 'video-config.json'), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'video-config.json'), configTemplate.replace(/__TITLE__/g, name), 'utf8');

  const readmeTemplate = fs.readFileSync(path.join(PKG_ROOT, 'templates', 'README.md'), 'utf8');
  fs.writeFileSync(path.join(projectDir, 'README.md'), readmeTemplate.replace(/__PROJECT__/g, name), 'utf8');

  console.log(`✅ Created project: ${name}

   ${name}/
   ├── video-config.json   edit this to build your video
   ├── output/             generated HyperFrames HTML
   ├── videos/             rendered MP4 files
   └── README.md

Next:
   cd ${name}
   j2hf generate
   j2hf preview`);
}
