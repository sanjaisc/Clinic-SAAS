#!/usr/bin/env node
// Persistent server wrapper - restarts Next.js if it crashes
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_DIR = '/home/z/my-project';

function startServer() {
  const child = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: PROJECT_DIR,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code, signal) => {
    console.log(`[keeper] Server exited with code=${code} signal=${signal}. Restarting in 2s...`);
    setTimeout(startServer, 2000);
  });

  child.on('error', (err) => {
    console.error(`[keeper] Server error:`, err);
    setTimeout(startServer, 2000);
  });
}

console.log('[keeper] Starting persistent Next.js server...');
startServer();