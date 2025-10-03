#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const DatabaseManager = require(path.join(process.cwd(), 'src/database/DatabaseManager'));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    // If no stdin provided, resolve quickly
    setTimeout(() => resolve(data), 50);
  });
}

(async () => {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const { name, description = '', status = 'active' } = input;
    if (!name) {
      throw new Error('name is required');
    }

    const db = new DatabaseManager();
    await db.initialize();
    const project = await db.createProject({ name, description, status });
    await db.close();

    process.stdout.write(JSON.stringify({ ok: true, project }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  }
})();

