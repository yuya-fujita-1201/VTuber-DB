import { Hono } from 'hono';
import { fillYouTubeContents, calculateTagRelations, generateTagEvidence } from '../scripts/fill-empty-tables.js';
import { updateStaleVTubers, recalculateStaleLevel, updateByTier } from '../scripts/update-vtuber-data.js';

export const adminMaintenanceRoutes = new Hono();

// 動画データを収集
// POST /api/admin/fill-contents
// body: { limit: 10, videosPerChannel: 5 }
adminMaintenanceRoutes.post('/fill-contents', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 10, videosPerChannel = 5 } = body;

    const result = await fillYouTubeContents(c.env, {
      limit,
      videosPerChannel,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.collected}本の動画を収集しました（${result.vtubers_processed}人のVTuber）`,
    });
  } catch (error) {
    console.error('Error in fill contents:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// タグ関連度を計算
// POST /api/admin/calculate-relations
// body: { minCooccurrence: 3 }
adminMaintenanceRoutes.post('/calculate-relations', async (c) => {
  try {
    const body = await c.req.json();
    const { minCooccurrence = 3 } = body;

    const result = await calculateTagRelations(c.env, {
      minCooccurrence,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.total}件のタグ関連度を計算しました`,
    });
  } catch (error) {
    console.error('Error in calculate relations:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// タグ根拠を生成
// POST /api/admin/generate-evidence
// body: { limit: 50 }
adminMaintenanceRoutes.post('/generate-evidence', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 50 } = body;

    const result = await generateTagEvidence(c.env, {
      limit,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.generated}件のタグ根拠を生成しました`,
    });
  } catch (error) {
    console.error('Error in generate evidence:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// すべてのメンテナンスを一括実行
// POST /api/admin/maintenance-all
// body: { contentLimit: 10, evidenceLimit: 50, minCooccurrence: 3 }
adminMaintenanceRoutes.post('/maintenance-all', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      contentLimit = 10,
      evidenceLimit = 50,
      minCooccurrence = 3,
    } = body;

    const results = {
      contents: null,
      relations: null,
      evidence: null,
    };

    // ステップ1: 動画データを収集
    console.log('[Maintenance All] Step 1: Filling YouTube contents...');
    results.contents = await fillYouTubeContents(c.env, {
      limit: contentLimit,
      videosPerChannel: 5,
    });

    // ステップ2: タグ関連度を計算
    console.log('[Maintenance All] Step 2: Calculating tag relations...');
    results.relations = await calculateTagRelations(c.env, {
      minCooccurrence,
    });

    // ステップ3: タグ根拠を生成
    console.log('[Maintenance All] Step 3: Generating tag evidence...');
    results.evidence = await generateTagEvidence(c.env, {
      limit: evidenceLimit,
    });

    return c.json({
      success: true,
      results,
      message: `メンテナンスが完了しました: 動画${results.contents.collected}本、関連度${results.relations.total}件、根拠${results.evidence.generated}件`,
    });
  } catch (error) {
    console.error('Error in maintenance all:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// 古いデータを持つVTuberを更新
// POST /api/admin/update-stale
// body: { limit: 50, minStaleLevel: 1 }
adminMaintenanceRoutes.post('/update-stale', async (c) => {
  try {
    const body = await c.req.json();
    const { limit = 50, minStaleLevel = 1 } = body;

    const result = await updateStaleVTubers(c.env, {
      limit,
      minStaleLevel,
    });

    return c.json({
      success: true,
      ...result,
      message: `${result.updated}人のVTuberデータを更新しました`,
    });
  } catch (error) {
    console.error('Error in update stale:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// すべてのVTuberのstale_levelを再計算
// POST /api/admin/recalculate-stale
adminMaintenanceRoutes.post('/recalculate-stale', async (c) => {
  try {
    const result = await recalculateStaleLevel(c.env);

    return c.json({
      success: true,
      ...result,
      message: `${result.updated}人のstale_levelを再計算しました`,
    });
  } catch (error) {
    console.error('Error in recalculate stale:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

// Tierごとにデータを更新
// POST /api/admin/update-by-tier
// body: { tier: 'S' }
adminMaintenanceRoutes.post('/update-by-tier', async (c) => {
  try {
    const body = await c.req.json();
    const { tier } = body;

    if (!['S', 'A', 'B', 'C'].includes(tier)) {
      return c.json({
        success: false,
        error: 'Invalid tier. Must be S, A, B, or C.',
      }, 400);
    }

    const result = await updateByTier(c.env, tier);

    return c.json({
      success: true,
      ...result,
      message: `Tier ${tier}の${result.updated}人のVTuberデータを更新しました`,
    });
  } catch (error) {
    console.error('Error in update by tier:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});
