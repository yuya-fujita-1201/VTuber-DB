import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const STATUS_OPTIONS = ['queued', 'resolved', 'rejected', 'duplicate'];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
};

const getDisplayUrl = (request) => (
  request.url
  || request.source_url
  || request.channel_url
  || request.request_url
  || request.link
  || ''
);

const getDisplayName = (request) => (
  request.name
  || request.vtuber_name
  || request.channel_name
  || request.requested_name
  || request.title
  || '-'
);

const getDuplicateReason = (request) => (
  request.duplicate_reason
  || request.duplicate_of
  || request.duplicate_target
  || request.reason
  || request.note
  || '-'
);

function IngestionRequests() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('queued');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusEdits, setStatusEdits] = useState({});
  const [savingId, setSavingId] = useState(null);

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

  const fetchRequests = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/ingestion-requests${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('取り込み申請の取得に失敗しました');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setRequests(list);

      const nextEdits = {};
      list.forEach((item) => {
        nextEdits[item.id] = item.status;
      });
      setStatusEdits(nextEdits);
    } catch (fetchError) {
      console.error('Error fetching ingestion requests:', fetchError);
      setError('取り込み申請の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests();
    }
  }, [isAuthenticated, statusFilter]);

  const handleStatusChange = (id, value) => {
    setStatusEdits((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const updateStatus = async (request) => {
    if (!token) return;
    const nextStatus = statusEdits[request.id] || request.status;
    if (nextStatus === request.status) return;

    setSavingId(request.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/ingestion-requests/${request.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('ステータス更新に失敗しました');
      }

      await fetchRequests();
    } catch (fetchError) {
      console.error('Error updating ingestion request:', fetchError);
      setError('ステータス更新に失敗しました');
    } finally {
      setSavingId(null);
    }
  };

  const visibleCount = useMemo(() => requests.length, [requests]);

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
          <h1 className="text-3xl font-bold text-gray-900">取り込み申請管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            VTuber追加リクエストのステータス管理を行います
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin" className="btn btn-secondary">
            ダッシュボード
          </Link>
          <button
            className="btn btn-primary"
            onClick={fetchRequests}
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
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500">表示件数: {visibleCount}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-gray-600">読み込み中...</div>
        ) : requests.length === 0 ? (
          <div className="text-gray-600">申請はありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">判定理由</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申請日時</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => {
                  const url = getDisplayUrl(request);
                  const displayStatus = statusEdits[request.id] || request.status;
                  return (
                    <tr key={request.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{request.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDisplayName(request)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            {url}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select
                          className="input"
                          value={displayStatus || ''}
                          onChange={(event) => handleStatusChange(request.id, event.target.value)}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {getDuplicateReason(request)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(request.created_at || request.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          className="btn btn-secondary text-sm"
                          onClick={() => updateStatus(request)}
                          disabled={savingId === request.id || displayStatus === request.status}
                        >
                          更新
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

export default IngestionRequests;
