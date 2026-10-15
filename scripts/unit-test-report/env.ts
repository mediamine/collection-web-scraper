import { config } from 'dotenv';
import { resolve } from 'path';

// The same files, in the same order, as ConfigModule in src/app.module.ts. dotenv never overrides a key that
// is already set, so the first file to define a key wins and a real environment variable beats them all.
export const ENV_FILES = ['.env', '.env.dev', '.env.prod'];

export const loadEnv = (cwd: string = process.cwd()) => {
  for (const file of ENV_FILES) {
    config({ path: resolve(cwd, file) });
  }
};
