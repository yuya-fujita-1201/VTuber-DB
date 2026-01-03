export async function getTableColumns(db, tableName) {
  const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  const { results } = await db.prepare(`PRAGMA table_info(${safeName})`).all();
  return results.map(row => row.name);
}

export function pickColumn(columns, candidates) {
  return candidates.find(candidate => columns.includes(candidate)) || null;
}

export async function enqueueJob(db, jobType, payload, options = {}) {
  const priority = options.priority ?? 5;
  const dedupe = options.dedupe || null;

  if (dedupe && Object.keys(dedupe).length > 0) {
    const clauses = [];
    const values = [];

    for (const [key, value] of Object.entries(dedupe)) {
      clauses.push(`json_extract(payload, '$.${key}') = ?`);
      values.push(value);
    }

    const sql = `
      SELECT id FROM jobs
      WHERE job_type = ?
        AND status IN ('queued', 'running')
        AND ${clauses.join(' AND ')}
      LIMIT 1
    `;

    const { results } = await db.prepare(sql).bind(jobType, ...values).all();
    if (results.length > 0) {
      return { id: results[0].id, existed: true };
    }
  }

  const payloadJson = JSON.stringify(payload ?? {});
  const result = await db
    .prepare(`
      INSERT INTO jobs (job_type, status, priority, payload)
      VALUES (?, 'queued', ?, ?)
    `)
    .bind(jobType, priority, payloadJson)
    .run();

  return { id: result.meta?.last_row_id, existed: false };
}
