import React, { useState, useEffect } from 'react';

function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [unverifiedTags, setUnverifiedTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const authenticate = () => {
    // 簡易認証（実際の実装ではより安全な方法を使用）
    if (password) {
      localStorage.setItem('admin_token', password);
      setIsAuthenticated(true);
      fetchAdminData();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setPassword(token);
      setIsAuthenticated(true);
      fetchAdminData();
    }
  }, []);

  const fetchAdminData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      // 統計情報
      const statsRes = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      // ログ
      const logsRes = await fetch('/api/admin/logs?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.data || []);
      }

      // 未承認タグ
      const tagsRes = await fetch('/api/admin/unverified-tags', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setUnverifiedTags(tagsData.data || []);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  const runSync = async (type) => {
    const token = localStorage.getItem('admin_token');
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sync/${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        alert(`${type}の同期を開始しました`);
        fetchAdminData();
      } else {
        alert('同期の開始に失敗しました');
      }
    } catch (error) {
      console.error('Error running sync:', error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const runAITagging = async () => {
    const token = localStorage.getItem('admin_token');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-tagging', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        alert('AIタグづけを開始しました');
        fetchAdminData();
      } else {
        alert('AIタグづけの開始に失敗しました');
      }
    } catch (error) {
      console.error('Error running AI tagging:', error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const verifyTag = async (vtuberId, tagId) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/tags/verify', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vtuber_id: vtuberId,
          tag_id: tagId,
          is_verified: 1,
        }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (error) {
      console.error('Error verifying tag:', error);
    }
  };

  const removeTag = async (vtuberId, tagId) => {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/tags/assign', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vtuber_id: vtuberId,
          tag_id: tagId,
        }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            管理者ログイン
          </h1>
          <input
            type="password"
            className="input mb-4"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && authenticate()}
          />
          <button
            className="btn btn-primary w-full"
            onClick={authenticate}
          >
            ログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">管理者ダッシュボード</h1>

      {/* Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            ダッシュボード
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tags'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('tags')}
          >
            未承認タグ ({unverifiedTags.length})
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            ログ
          </button>
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">VTuber</div>
                <div className="text-3xl font-bold text-primary-600">
                  {stats.vtubers?.toLocaleString() || 0}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">タグ</div>
                <div className="text-3xl font-bold text-primary-600">
                  {stats.tags?.toLocaleString() || 0}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">未承認タグ</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.unverified_tags?.toLocaleString() || 0}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-gray-600 mb-1">配信情報</div>
                <div className="text-3xl font-bold text-primary-600">
                  {stats.streams?.toLocaleString() || 0}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">操作</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                className="btn btn-primary"
                onClick={() => runSync('youtube')}
                disabled={loading}
              >
                YouTube同期
              </button>
              <button
                className="btn btn-primary"
                onClick={() => runSync('web')}
                disabled={loading}
              >
                Webスクレイピング
              </button>
              <button
                className="btn btn-primary"
                onClick={runAITagging}
                disabled={loading}
              >
                AIタグづけ実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Tab */}
      {activeTab === 'tags' && (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            未承認タグ
          </h2>
          {unverifiedTags.length === 0 ? (
            <p className="text-gray-600">未承認のタグはありません</p>
          ) : (
            <div className="space-y-4">
              {unverifiedTags.map((item) => (
                <div
                  key={`${item.vtuber_id}-${item.tag_id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-semibold text-gray-900">
                      {item.vtuber_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      タグ: {item.tag_name} ({item.category})
                    </div>
                    <div className="text-xs text-gray-500">
                      信頼度: {(item.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="btn btn-primary text-sm"
                      onClick={() => verifyTag(item.vtuber_id, item.tag_id)}
                    >
                      承認
                    </button>
                    <button
                      className="btn btn-secondary text-sm"
                      onClick={() => removeTag(item.vtuber_id, item.tag_id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            更新ログ
          </h2>
          {logs.length === 0 ? (
            <p className="text-gray-600">ログはありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      タスク
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      処理件数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      開始時刻
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      完了時刻
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.task_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : log.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.records_processed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.started_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.completed_at
                          ? new Date(log.completed_at).toLocaleString('ja-JP')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Admin;
