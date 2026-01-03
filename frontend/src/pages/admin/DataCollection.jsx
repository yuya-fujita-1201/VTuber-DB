import React, { useState, useEffect } from 'react';

function DataCollection() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [stats, setStats] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [collectLimit, setCollectLimit] = useState(50);
  const [tagLimit, setTagLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [massCollecting, setMassCollecting] = useState(false);
  const [massCollectTarget, setMassCollectTarget] = useState(1000);
  const [massCollectOrder, setMassCollectOrder] = useState('relevance');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setPassword(savedToken);
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchAgencies();
    }
  }, [isAuthenticated]);

  const handleUnauthorized = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setIsAuthenticated(false);
    setError('認証が切れました。再ログインしてください。');
  };

  const authenticate = () => {
    const trimmed = password.trim();
    if (!trimmed) return;
    localStorage.setItem('admin_token', trimmed);
    setToken(trimmed);
    setIsAuthenticated(true);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/collection-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('統計情報の取得に失敗しました');
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('統計情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencies = async () => {
    try {
      const res = await fetch('/api/admin/agencies', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('事務所一覧の取得に失敗しました');
      }

      const data = await res.json();
      setAgencies(data.agencies || []);
    } catch (err) {
      console.error('Error fetching agencies:', err);
    }
  };

  const handleBatchCollect = async () => {
    setCollecting(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/batch-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: collectLimit,
          agency: selectedAgency === 'all' ? null : selectedAgency,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('バッチ収集に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.collected}件のVTuberを収集しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in batch collect:', err);
      setError('バッチ収集に失敗しました: ' + err.message);
    } finally {
      setCollecting(false);
    }
  };

  const handleMassCollect = async () => {
    setMassCollecting(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/mass-collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetCount: massCollectTarget,
          order: massCollectOrder,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('大規模収集に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.collected}件のVTuberを収集しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in mass collect:', err);
      setError('大規模収集に失敗しました: ' + err.message);
    } finally {
      setMassCollecting(false);
    }
  };

  const handleBatchTag = async () => {
    setTagging(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/batch-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: tagLimit,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('AIタグ付けに失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.queued}件のAIタグ付けジョブをキューに追加しました`);
    } catch (err) {
      console.error('Error in batch tag:', err);
      setError('AIタグ付けに失敗しました: ' + err.message);
    } finally {
      setTagging(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">管理者認証</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && authenticate()}
            placeholder="パスワード"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
          />
          <button onClick={authenticate} className="btn btn-primary w-full">
            ログイン
          </button>
          {error && <p className="text-red-600 mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">データ収集</h1>

      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">総VTuber数</div>
            <div className="text-3xl font-bold text-primary-600">
              {stats.total_vtubers}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">YouTube連携済み</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.with_youtube}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">タグ付け済み</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.with_tags}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600 mb-1">事務所数</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.by_agency?.length || 0}
            </div>
          </div>
        </div>
      )}

      {/* メッセージ表示 */}
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* 大規模収集 */}
      <div className="card mb-8 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          🚀 大規模収集（YouTube検索ベース）
        </h2>
        <p className="text-gray-600 mb-6">
          30種類のキーワードでYouTubeを検索し、VTuberを大量に収集します。
          個人勢や小規模事務所のVTuberも含まれます。
        </p>

         <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目標収集数
            </label>
            <input
              type="number"
              value={massCollectTarget}
              onChange={(e) => setMassCollectTarget(parseInt(e.target.value))}
              min="100"
              max="2000"
              step="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              推奨: 1000件（初回）、500件（追加）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              検索順序
            </label>
            <select
              value={massCollectOrder}
              onChange={(e) => setMassCollectOrder(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="relevance">関連度順（デフォルト）</option>
              <option value="date">新しい順（新人発見）</option>
              <option value="viewCount">再生回数順（人気順）</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              新人発見には「新しい順」を推奨
            </p>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            ※YouTube APIのクォータを消費します。大量収集は計画的に実行してください。
          </p>

          <button
            onClick={handleMassCollect}
            disabled={massCollecting}
            className="btn btn-primary w-full text-lg py-3"
          >
            {massCollecting ? '収集中... 数分かかる場合があります' : `${massCollectTarget}件の大規模収集を実行`}
          </button>

          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <h3 className="font-semibold text-gray-900 mb-2">検索キーワード例：</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">ホロライブ</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">にじさんじ</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">ぶいすぽ</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">個人勢VTuber</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">VTuber 歌ってみた</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">VTuber ゲーム実況</span>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">など30種類</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* バッチ収集 */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            バッチ収集
          </h2>
          <p className="text-gray-600 mb-6">
            VTuber事務所のチャンネルから一括でデータを収集します
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                事務所
              </label>
              <select
                value={selectedAgency}
                onChange={(e) => setSelectedAgency(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">すべて</option>
                {agencies.map((agency) => (
                  <option key={agency.name_en} value={agency.name_en}>
                    {agency.name} ({agency.channel_count}チャンネル)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                収集件数
              </label>
              <input
                type="number"
                value={collectLimit}
                onChange={(e) => setCollectLimit(parseInt(e.target.value))}
                min="1"
                max="200"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <button
              onClick={handleBatchCollect}
              disabled={collecting}
              className="btn btn-primary w-full"
            >
              {collecting ? '収集中...' : 'バッチ収集を実行'}
            </button>
          </div>
        </div>

        {/* AIタグ付け */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            AIタグ付け
          </h2>
          <p className="text-gray-600 mb-6">
            タグが未設定のVTuberに対してAIで自動タグ付けを実行します
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                処理件数
              </label>
              <input
                type="number"
                value={tagLimit}
                onChange={(e) => setTagLimit(parseInt(e.target.value))}
                min="1"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                ※ジョブキューに追加されます。実行には数分かかる場合があります。
              </p>
            </div>

            <button
              onClick={handleBatchTag}
              disabled={tagging}
              className="btn btn-primary w-full"
            >
              {tagging ? 'ジョブ追加中...' : 'AIタグ付けを実行'}
            </button>
          </div>
        </div>
      </div>

      {/* 事務所別統計 */}
      {stats && stats.by_agency && stats.by_agency.length > 0 && (
        <div className="card mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            事務所別統計
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">事務所</th>
                  <th className="text-right py-2 px-4">VTuber数</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_agency.map((item) => (
                  <tr key={item.agency} className="border-b">
                    <td className="py-2 px-4">{item.agency}</td>
                    <td className="text-right py-2 px-4">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? '更新中...' : '統計を更新'}
        </button>
      </div>
    </div>
  );
}

export default DataCollection;
