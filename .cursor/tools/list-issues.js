#!/usr/bin/env node
const path = require('path');
const DatabaseManager = require(path.join(process.cwd(), 'src/database/DatabaseManager'));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 50);
  });
}

(async () => {
  try {
    const raw = await readStdin();
    const input = raw ? JSON.parse(raw) : {};
    const projectId = input.project_id;
    if (projectId === undefined || projectId === null) {
      throw new Error('project_id is required');
    }

    const db = new DatabaseManager();
    await db.initialize();
    const issues = await db.getIssues(projectId);
    await db.close();

    process.stdout.write(JSON.stringify({ ok: true, issues }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  }
})();

