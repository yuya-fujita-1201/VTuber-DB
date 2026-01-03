import { getTableColumns, pickColumn } from './job-utils.js';

export async function buildTagRelationsJob(env) {
  const db = env.DB;

  const relationColumns = await getTableColumns(db, 'tag_relations');
  const tagIdColumn = pickColumn(relationColumns, ['tag_id']);
  const relatedTagIdColumn = pickColumn(relationColumns, ['related_tag_id', 'related_id', 'target_tag_id']);
  const relationTypeColumn = pickColumn(relationColumns, ['relation_type', 'type']);
  const weightColumn = pickColumn(relationColumns, ['weight', 'score']);
  const updatedAtColumn = relationColumns.includes('updated_at') ? 'updated_at' : null;

  if (!tagIdColumn || !relatedTagIdColumn) {
    throw new Error('tag_relations table missing required columns');
  }

  if (relationTypeColumn) {
    await db
      .prepare(`DELETE FROM tag_relations WHERE ${relationTypeColumn} = ?`)
      .bind('cooccur')
      .run();
  } else {
    await db.prepare('DELETE FROM tag_relations').run();
  }

  const { results: pairs } = await db
    .prepare(`
      SELECT vt1.tag_id as tag_id,
             vt2.tag_id as related_tag_id,
             COUNT(*) as weight
      FROM vtuber_tags vt1
      JOIN vtuber_tags vt2
        ON vt1.vtuber_id = vt2.vtuber_id
       AND vt1.tag_id < vt2.tag_id
      GROUP BY vt1.tag_id, vt2.tag_id
    `)
    .all();

  const insertColumns = [tagIdColumn, relatedTagIdColumn];
  if (relationTypeColumn) insertColumns.push(relationTypeColumn);
  if (weightColumn) insertColumns.push(weightColumn);

  const placeholders = insertColumns.map(() => '?').join(', ');
  const conflictColumns = [tagIdColumn, relatedTagIdColumn];
  if (relationTypeColumn) conflictColumns.push(relationTypeColumn);

  const updateClauses = [];
  if (weightColumn) updateClauses.push(`${weightColumn} = excluded.${weightColumn}`);
  if (updatedAtColumn) updateClauses.push(`${updatedAtColumn} = CURRENT_TIMESTAMP`);

  const upsertClause = updateClauses.length > 0
    ? `ON CONFLICT(${conflictColumns.join(', ')}) DO UPDATE SET ${updateClauses.join(', ')}`
    : '';

  const insertSql = `
    INSERT INTO tag_relations (${insertColumns.join(', ')})
    VALUES (${placeholders})
    ${upsertClause}
  `;

  let relationCount = 0;

  for (const pair of pairs) {
    const values = [pair.tag_id, pair.related_tag_id];
    if (relationTypeColumn) values.push('cooccur');
    if (weightColumn) values.push(pair.weight);

    await db.prepare(insertSql).bind(...values).run();

    const reverseValues = [pair.related_tag_id, pair.tag_id];
    if (relationTypeColumn) reverseValues.push('cooccur');
    if (weightColumn) reverseValues.push(pair.weight);

    await db.prepare(insertSql).bind(...reverseValues).run();
    relationCount += 2;
  }

  return { relations_built: relationCount };
}
