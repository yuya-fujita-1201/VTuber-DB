export async function tableExists(db, tableName) {
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .bind(tableName)
    .all();
  return results.length > 0;
}

export async function columnExists(db, tableName, columnName) {
  const { results } = await db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();
  return results.some((col) => col.name === columnName);
}

export async function enqueueJob(db, jobType, payload, priority = 5) {
  const exists = await tableExists(db, 'jobs');
  if (!exists) {
    return { enqueued: 0, skipped: true };
  }

  await db
    .prepare('INSERT INTO jobs (job_type, payload, priority) VALUES (?, ?, ?)')
    .bind(jobType, JSON.stringify(payload), priority)
    .run();

  return { enqueued: 1, skipped: false };
}
