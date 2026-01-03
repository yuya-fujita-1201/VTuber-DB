import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  queued: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
};

function JobMonitor() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setPassword(savedToken);
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

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

  const fetchJobs = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.set('job_type', typeFilter);
      }

      const query = params.toString();
      const res = await fetch(`/api/admin/jobs${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('ジョブ一覧の取得に失敗しました');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setJobs(list);
    } catch (fetchError) {
      console.error('Error fetching jobs:', fetchError);
      setError('ジョブ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
    }
  }, [isAuthenticated, statusFilter, typeFilter]);

  const jobTypes = useMemo(() => {
    const types = new Set();
    jobs.forEach((job) => {
      const type = job.job_type || job.type;
      if (type) types.add(type);
    });
    return Array.from(types).sort();
  }, [jobs]);

  const retryJob = async (jobId) => {
    if (!token) return;
    setRetryingId(jobId);
    setError('');
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('再実行に失敗しました');
      }

      await fetchJobs();
    } catch (fetchError) {
      console.error('Error retrying job:', fetchError);
      setError('再実行に失敗しました');
    } finally {
      setRetryingId(null);
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
            onChange={(event) => setPassword(event.target.value)}
            onKeyPress={(event) => event.key === 'Enter' && authenticate()}
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ジョブ監視</h1>
          <p className="text-sm text-gray-500 mt-1">
            queued / running / success / failed のジョブを確認できます
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin" className="btn btn-secondary">
            ダッシュボード
          </Link>
          <button
            className="btn btn-primary"
            onClick={fetchJobs}
            disabled={loading}
          >
            更新
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">すべて</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ジョブタイプ</label>
            <select
              className="input"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">すべて</option>
              {jobTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500">
              表示件数: {jobs.length}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-gray-600">読み込み中...</div>
        ) : jobs.length === 0 ? (
          <div className="text-gray-600">該当するジョブはありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイプ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">開始</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">完了</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">エラー</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {jobs.map((job) => {
                  const status = job.status || 'unknown';
                  const statusStyle = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700';
                  const lastError = job.last_error || job.error || job.error_message || '-';
                  return (
                    <tr key={job.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{job.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {job.job_type || job.type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyle}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(job.created_at || job.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(job.started_at || job.startedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(job.completed_at || job.completedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        <span title={lastError}>{lastError}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          className="btn btn-secondary text-sm"
                          onClick={() => retryJob(job.id)}
                          disabled={retryingId === job.id || status === 'running'}
                        >
                          再実行
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobMonitor;
