/**
 * Fridayy - Cross-Platform Global Directory Resolver
 * Resolves an OS-appropriate, per-user directory for Fridayy state that should
 * be shared across projects on the same machine (e.g. credentials), following
 * each platform's own convention instead of assuming a POSIX-style home layout.
 */

import os from 'node:os';
import path from 'node:path';

/**
 * Returns the OS-appropriate root directory for per-user application config:
 * - Windows: %APPDATA% (falls back to <home>/AppData/Roaming)
 * - macOS:   <home>/Library/Application Support
 * - Linux/other: $XDG_CONFIG_HOME (falls back to <home>/.config)
 */
export function getGlobalConfigDir(): string {
  const home = os.homedir();

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'fridayy');
  }

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'fridayy');
  }

  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'fridayy');
}

/**
 * Path to the global credentials store shared across every Fridayy project on
 * this device. Intended as a safer alternative to embedding `auth.*.value`
 * secrets directly inside a per-project fridayy.config.json (which is easy to
 * accidentally commit to source control).
 */
export function getGlobalCredentialsPath(): string {
  return path.join(getGlobalConfigDir(), 'credentials.json');
}
