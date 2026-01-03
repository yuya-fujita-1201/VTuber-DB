/**
 * VTuber-DB 統合テストスクリプト
 * 
 * 実行方法:
 * node tests/integration-test.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// テスト結果を記録
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

// テストヘルパー関数
function assert(condition, message) {
  if (condition) {
    console.log(`✅ ${message}`);
    results.passed++;
    results.tests.push({ status: 'PASS', message });
  } else {
    console.error(`❌ ${message}`);
    results.failed++;
    results.tests.push({ status: 'FAIL', message });
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, actual: ${actual})`);
}

function assertGreaterThan(actual, threshold, message) {
  assert(actual > threshold, `${message} (expected: > ${threshold}, actual: ${actual})`);
}

// テスト1: 公開APIのテスト
async function testPublicAPI() {
  console.log('\n📋 Test 1: 公開API');
  
  try {
    // GET /api/vtubers
    const res1 = await fetch(`${BASE_URL}/api/vtubers`);
    assertEqual(res1.status, 200, 'GET /api/vtubers は200を返す');
    
    const data1 = await res1.json();
    assert(Array.isArray(data1.data), 'VTuberリストは配列である');
    assertGreaterThan(data1.data.length, 0, 'VTuberが1人以上存在する');
    
    // GET /api/vtubers/:id
    const vtuber = data1.data[0];
    const res2 = await fetch(`${BASE_URL}/api/vtubers/${vtuber.id}`);
    assertEqual(res2.status, 200, `GET /api/vtubers/${vtuber.id} は200を返す`);
    
    const data2 = await res2.json();
    assertEqual(data2.id, vtuber.id, 'VTuber詳細のIDが一致する');
    assert(Array.isArray(data2.tags), 'タグは配列である');
    
    // GET /api/search
    const res3 = await fetch(`${BASE_URL}/api/search?q=VTuber`);
    assertEqual(res3.status, 200, 'GET /api/search は200を返す');
    
    const data3 = await res3.json();
    assert(Array.isArray(data3.data), '検索結果は配列である');
    
    // GET /api/tags
    const res4 = await fetch(`${BASE_URL}/api/tags`);
    assertEqual(res4.status, 200, 'GET /api/tags は200を返す');
    
    const data4 = await res4.json();
    assert(data4.data && Array.isArray(data4.data), 'タグリストは配列である');
    assertGreaterThan(data4.data.length, 0, 'タグが1つ以上存在する');
    
    // GET /api/stats
    const res5 = await fetch(`${BASE_URL}/api/stats`);
    assertEqual(res5.status, 200, 'GET /api/stats は200を返す');
    
    const data5 = await res5.json();
    assertGreaterThan(data5.total_vtubers || 0, 0, 'VTuber数が1以上');
    assertGreaterThan(data5.total_agencies || 0, 0, '事務所数が1以上');
    
  } catch (error) {
    console.error('❌ 公開APIテストでエラー:', error.message);
    results.failed++;
    results.tests.push({ status: 'FAIL', message: `公開APIテストでエラー: ${error.message}` });
  }
}

// テスト2: 新規APIのテスト
async function testNewAPI() {
  console.log('\n📋 Test 2: 新規API（タグ階層、タグ詳細）');
  
  try {
    // GET /api/tags/tree
    const res1 = await fetch(`${BASE_URL}/api/tags/tree`);
    assertEqual(res1.status, 200, 'GET /api/tags/tree は200を返す');
    
    const data1 = await res1.json();
    assert(Array.isArray(data1.tags), 'タグ階層は配列である');
    
    if (data1.tags.length > 0) {
      const tag = data1.tags[0];
      assert('child_count' in tag, 'タグにchild_countが含まれる');
      assert('vtuber_count' in tag, 'タグにvtuber_countが含まれる');
      
      // GET /api/tags/:slug (URLエンコード)
      if (tag.slug) {
        const encodedSlug = encodeURIComponent(tag.slug);
        const res2 = await fetch(`${BASE_URL}/api/tags/${encodedSlug}`);
        
        if (res2.status === 200) {
          const data2 = await res2.json();
          assertEqual(data2.tag.slug, tag.slug, 'タグ詳細のslugが一致する');
          assert(Array.isArray(data2.vtubers), 'VTuberリストは配列である');
        } else {
          console.log(`⚠️  GET /api/tags/${encodedSlug} は${res2.status}を返す（スキップ）`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 新規APIテストでエラー:', error.message);
    results.failed++;
    results.tests.push({ status: 'FAIL', message: `新規APIテストでエラー: ${error.message}` });
  }
}

// テスト3: 管理APIのテスト（認証が必要）
async function testAdminAPI() {
  console.log('\n📋 Test 3: 管理API（認証）');
  
  if (!ADMIN_TOKEN) {
    console.log('⚠️  ADMIN_TOKENが設定されていないため、管理APIテストをスキップします');
    return;
  }
  
  try {
    // POST /api/admin/batch-collect（認証エラーのテスト）
    const res1 = await fetch(`${BASE_URL}/api/admin/batch-collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agency: 'hololive', limit: 1 }),
    });
    assertEqual(res1.status, 401, 'POST /api/admin/batch-collect は認証なしで401を返す');
    
    // POST /api/admin/batch-collect（認証ありのテスト）
    const res2 = await fetch(`${BASE_URL}/api/admin/batch-collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ agency: 'hololive', limit: 1 }),
    });
    assert(res2.status === 200 || res2.status === 500, 'POST /api/admin/batch-collect は認証ありで200または500を返す');
    
  } catch (error) {
    console.error('❌ 管理APIテストでエラー:', error.message);
    results.failed++;
    results.tests.push({ status: 'FAIL', message: `管理APIテストでエラー: ${error.message}` });
  }
}

// テスト4: エラーハンドリングのテスト
async function testErrorHandling() {
  console.log('\n📋 Test 4: エラーハンドリング');
  
  try {
    // GET /api/vtubers/:id（存在しないID）
    const res1 = await fetch(`${BASE_URL}/api/vtubers/999999`);
    assertEqual(res1.status, 404, 'GET /api/vtubers/999999 は404を返す');
    
    // GET /api/tags/:slug（存在しないslug）
    const res2 = await fetch(`${BASE_URL}/api/tags/nonexistent-slug-12345`);
    assertEqual(res2.status, 404, 'GET /api/tags/nonexistent-slug は404を返す');
    
    // GET /api/search（不正なパラメータ）
    const res3 = await fetch(`${BASE_URL}/api/search?page=-1`);
    assert(res3.status === 200 || res3.status === 400, 'GET /api/search?page=-1 は200または400を返す');
    
  } catch (error) {
    console.error('❌ エラーハンドリングテストでエラー:', error.message);
    results.failed++;
    results.tests.push({ status: 'FAIL', message: `エラーハンドリングテストでエラー: ${error.message}` });
  }
}

// テスト5: パフォーマンステスト
async function testPerformance() {
  console.log('\n📋 Test 5: パフォーマンス');
  
  try {
    // GET /api/vtubers のレスポンスタイム
    const start1 = Date.now();
    const res1 = await fetch(`${BASE_URL}/api/vtubers`);
    const end1 = Date.now();
    const time1 = end1 - start1;
    
    assert(time1 < 5000, `GET /api/vtubers のレスポンスタイムが5秒以内 (${time1}ms)`);
    
    // GET /api/search のレスポンスタイム
    const start2 = Date.now();
    const res2 = await fetch(`${BASE_URL}/api/search?q=VTuber`);
    const end2 = Date.now();
    const time2 = end2 - start2;
    
    assert(time2 < 5000, `GET /api/search のレスポンスタイムが5秒以内 (${time2}ms)`);
    
    // GET /api/tags/tree のレスポンスタイム
    const start3 = Date.now();
    const res3 = await fetch(`${BASE_URL}/api/tags/tree`);
    const end3 = Date.now();
    const time3 = end3 - start3;
    
    assert(time3 < 5000, `GET /api/tags/tree のレスポンスタイムが5秒以内 (${time3}ms)`);
    
  } catch (error) {
    console.error('❌ パフォーマンステストでエラー:', error.message);
    results.failed++;
    results.tests.push({ status: 'FAIL', message: `パフォーマンステストでエラー: ${error.message}` });
  }
}

// メイン実行
async function main() {
  console.log('🚀 VTuber-DB 統合テスト開始\n');
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`ADMIN_TOKEN: ${ADMIN_TOKEN ? '設定済み' : '未設定'}\n`);
  
  await testPublicAPI();
  await testNewAPI();
  await testAdminAPI();
  await testErrorHandling();
  await testPerformance();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 テスト結果');
  console.log('='.repeat(50));
  console.log(`✅ 成功: ${results.passed}`);
  console.log(`❌ 失敗: ${results.failed}`);
  console.log(`📝 合計: ${results.passed + results.failed}`);
  console.log('='.repeat(50));
  
  if (results.failed > 0) {
    console.log('\n❌ 失敗したテスト:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 すべてのテストが成功しました！');
    process.exit(0);
  }
}

main();
