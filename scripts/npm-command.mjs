import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export function execNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return exec(invocation.executable, invocation.args, options);
}

export function npmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && /npm-cli\.js$/i.test(npmExecPath)) {
    return {
      executable: process.execPath,
      args: [npmExecPath, ...args],
    };
  }

  if (process.platform === 'win32') {
    return {
      executable: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...args],
    };
  }

  return { executable: 'npm', args };
}
