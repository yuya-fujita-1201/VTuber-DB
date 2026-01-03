import { useState, useEffect } from 'react';

function Maintenance() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fillingContents, setFillingContents] = useState(false);
  const [calculatingRelations, setCalculatingRelations] = useState(false);
  const [generatingEvidence, setGeneratingEvidence] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [updatingStale, setUpdatingStale] = useState(false);
  const [recalculatingStale, setRecalculatingStale] = useState(false);
  
  const [staleLimit, setStaleLimit] = useState(50);
  const [minStaleLevel, setMinStaleLevel] = useState(1);
  
  const [contentLimit, setContentLimit] = useState(10);
  const [evidenceLimit, setEvidenceLimit] = useState(50);
  const [minCooccurrence, setMinCooccurrence] = useState(3);
  const [selectedTier, setSelectedTier] = useState('S');
  
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
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('統計情報の取得に失敗しました');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('統計情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleFillContents = async () => {
    setFillingContents(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/fill-contents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: contentLimit,
          videosPerChannel: 5,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('動画データの収集に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.collected}本の動画を収集しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in fill contents:', err);
      setError('動画データの収集に失敗しました: ' + err.message);
    } finally {
      setFillingContents(false);
    }
  };

  const handleCalculateRelations = async () => {
    setCalculatingRelations(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/calculate-relations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          minCooccurrence,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('タグ関連度の計算に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.total}件のタグ関連度を計算しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in calculate relations:', err);
      setError('タグ関連度の計算に失敗しました: ' + err.message);
    } finally {
      setCalculatingRelations(false);
    }
  };

  const handleGenerateEvidence = async () => {
    setGeneratingEvidence(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/generate-evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: evidenceLimit,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('タグ根拠の生成に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.generated}件のタグ根拠を生成しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in generate evidence:', err);
      setError('タグ根拠の生成に失敗しました: ' + err.message);
    } finally {
      setGeneratingEvidence(false);
    }
  };

  const handleMaintenanceAll = async () => {
    setRunningAll(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/maintenance-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentLimit,
          evidenceLimit,
          minCooccurrence,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('メンテナンスの実行に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || 'メンテナンスが完了しました');
      fetchStats();
    } catch (err) {
      console.error('Error in maintenance all:', err);
      setError('メンテナンスの実行に失敗しました: ' + err.message);
    } finally {
      setRunningAll(false);
    }
  };

  const handleUpdateStale = async () => {
    setUpdatingStale(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/update-stale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          limit: staleLimit,
          minStaleLevel,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('データ更新に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.updated}人のVTuberデータを更新しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in update stale:', err);
      setError('データ更新に失敗しました: ' + err.message);
    } finally {
      setUpdatingStale(false);
    }
  };

  const handleRecalculateStale = async () => {
    setRecalculatingStale(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/admin/recalculate-stale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('stale_levelの再計算に失敗しました');
      }

      const data = await res.json();
      setMessage(data.message || `${data.updated}人のstale_levelを再計算しました`);
      fetchStats();
    } catch (err) {
      console.error('Error in recalculate stale:', err);
      setError('stale_levelの再計算に失敗しました: ' + err.message);
    } finally {
      setRecalculatingStale(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">管理者認証</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && authenticate()}
            placeholder="管理者パスワード"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
          />
          <button onClick={authenticate} className="btn btn-primary w-full">
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        🔧 データメンテナンス
      </h1>

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

      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-blue-50 border-blue-200">
            <div className="text-sm text-gray-600">総VTuber数</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_vtubers}</div>
          </div>
          <div className="card bg-green-50 border-green-200">
            <div className="text-sm text-gray-600">動画データ</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_contents || 0}本</div>
          </div>
          <div className="card bg-purple-50 border-purple-200">
            <div className="text-sm text-gray-600">タグ関連度</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_relations || 0}件</div>
          </div>
          <div className="card bg-pink-50 border-pink-200">
            <div className="text-sm text-gray-600">タグ根拠</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_evidence || 0}件</div>
          </div>
        </div>
      )}

      {/* 一括実行 */}
      <div className="card mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          ⚡ 一括メンテナンス実行
        </h2>
        <p className="text-gray-600 mb-6">
          動画データ収集、タグ関連度計算、タグ根拠生成を一括で実行します。
        </p>

        <button
          onClick={handleMaintenanceAll}
          disabled={runningAll}
          className="btn btn-primary w-full text-lg py-3"
        >
          {runningAll ? '実行中... 数分かかる場合があります' : '一括メンテナンスを実行'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 動画データ収集 */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📹 動画データ収集
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            youtube_contentsテーブルが空のVTuberの動画データを収集します。
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              処理するVTuber数
            </label>
            <input
              type="number"
              value={contentLimit}
              onChange={(e) => setContentLimit(parseInt(e.target.value))}
              min="1"
              max="50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              推奨: 10件（1VTuberあたり5本の動画）
            </p>
          </div>

          <button
            onClick={handleFillContents}
            disabled={fillingContents}
            className="btn btn-primary w-full"
          >
            {fillingContents ? '収集中...' : '動画データを収集'}
          </button>
        </div>

        {/* タグ関連度計算 */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            🔗 タグ関連度計算
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            tag_relationsテーブルにタグ間の関連度を計算して保存します。
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最小共起回数
            </label>
            <input
              type="number"
              value={minCooccurrence}
              onChange={(e) => setMinCooccurrence(parseInt(e.target.value))}
              min="1"
              max="10"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              推奨: 3回（同じVTuberに3回以上共起）
            </p>
          </div>

          <button
            onClick={handleCalculateRelations}
            disabled={calculatingRelations}
            className="btn btn-primary w-full"
          >
            {calculatingRelations ? '計算中...' : 'タグ関連度を計算'}
          </button>
        </div>

        {/* タグ根拠生成 */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📝 タグ根拠生成
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            vtuber_tag_evidenceテーブルにタグの根拠を生成します。
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              処理するVTuber-タグペア数
            </label>
            <input
              type="number"
              value={evidenceLimit}
              onChange={(e) => setEvidenceLimit(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              推奨: 50件
            </p>
          </div>

          <button
            onClick={handleGenerateEvidence}
            disabled={generatingEvidence}
            className="btn btn-primary w-full"
          >
            {generatingEvidence ? '生成中...' : 'タグ根拠を生成'}
          </button>
        </div>
      </div>

      {/* データ更新セクション */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🔄 データ更新
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 古いデータを更新 */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              📊 古いデータを更新
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              stale_levelが高いVTuberのデータ（登録者数、視聴回数など）を優先的に更新します。
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                更新するVTuber数
              </label>
              <input
                type="number"
                value={staleLimit}
                onChange={(e) => setStaleLimit(parseInt(e.target.value))}
                min="1"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                推奨: 50件
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最小stale_level
              </label>
              <select
                value={minStaleLevel}
                onChange={(e) => setMinStaleLevel(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="0">0: 新鮮（1週間以内）</option>
                <option value="1">1: やや古い（1ヶ月以内）</option>
                <option value="2">2: 古い（3ヶ月以内）</option>
                <option value="3">3: 非常に古い（3ヶ月以上）</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                推奨: 1（やや古い）
              </p>
            </div>

            <button
              onClick={handleUpdateStale}
              disabled={updatingStale}
              className="btn btn-primary w-full"
            >
              {updatingStale ? '更新中...' : '古いデータを更新'}
            </button>
          </div>

          {/* stale_levelを再計算 */}
          <div className="card">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              🔢 stale_levelを再計算
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              すべてのVTuberのstale_level（データの鮮度）を再計算します。
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h4 className="font-bold text-gray-900 mb-2">stale_levelとは？</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>0</strong>: 新鮮（1週間以内に更新）</li>
                <li>• <strong>1</strong>: やや古い（1ヶ月以内に更新）</li>
                <li>• <strong>2</strong>: 古い（3ヶ月以内に更新）</li>
                <li>• <strong>3</strong>: 非常に古い（3ヶ月以上更新なし）</li>
              </ul>
            </div>

            <button
              onClick={handleRecalculateStale}
              disabled={recalculatingStale}
              className="btn btn-secondary w-full"
            >
              {recalculatingStale ? '計算中...' : 'stale_levelを再計算'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Maintenance;
