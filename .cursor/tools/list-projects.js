#!/usr/bin/env node
const path = require('path');
const DatabaseManager = require(path.join(process.cwd(), 'src/database/DatabaseManager'));

(async () => {
  try {
    const db = new DatabaseManager();
    await db.initialize();
    const projects = await db.getProjects();
    await db.close();
    process.stdout.write(JSON.stringify({ ok: true, projects }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }));
    process.exitCode = 1;
  }
})();

