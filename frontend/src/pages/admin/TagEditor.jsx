import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
};

const normalizeAliases = (tag) => {
  if (!tag) return [];
  const raw = tag.aliases || tag.alias || tag.alias_list || tag.aliases_json || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const buildTree = (tags) => {
  const nodes = new Map();
  tags.forEach((tag) => {
    nodes.set(tag.id, { ...tag, children: [] });
  });

  const rootsByCategory = {};
  nodes.forEach((node) => {
    const parentId = node.parent_id ?? node.parentId;
    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
    } else {
      const category = node.category || 'uncategorized';
      if (!rootsByCategory[category]) {
        rootsByCategory[category] = [];
      }
      rootsByCategory[category].push(node);
    }
  });

  const sortNodes = (nodeList) => {
    nodeList.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    nodeList.forEach((node) => {
      if (node.children.length > 0) {
        sortNodes(node.children);
      }
    });
  };

  Object.values(rootsByCategory).forEach(sortNodes);
  return rootsByCategory;
};

function TagEditor() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [tags, setTags] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    parent_id: '',
    status: '',
    policy: '',
  });
  const [aliases, setAliases] = useState([]);
  const [aliasInput, setAliasInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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

  const fetchTags = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tags', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('タグ一覧の取得に失敗しました');
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setTags(list);
    } catch (fetchError) {
      console.error('Error fetching tags:', fetchError);
      setError('タグ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTags();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedId) {
      setAliases([]);
      return;
    }
    const selectedTag = tags.find((tag) => tag.id === selectedId);
    if (!selectedTag) return;

    setForm({
      name: selectedTag.name || '',
      category: selectedTag.category || '',
      description: selectedTag.description || '',
      parent_id: selectedTag.parent_id ? String(selectedTag.parent_id) : '',
      status: selectedTag.status || '',
      policy: selectedTag.policy || '',
    });
    setAliases(normalizeAliases(selectedTag));
  }, [selectedId, tags]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    tags.forEach((tag) => {
      if (tag.category) set.add(tag.category);
    });
    return Array.from(set).sort();
  }, [tags]);

  const treeByCategory = useMemo(() => buildTree(tags), [tags]);

  const handleSelectTag = (tagId) => {
    setInfo('');
    setSelectedId(tagId);
  };

  const resetForm = () => {
    setSelectedId(null);
    setForm({
      name: '',
      category: '',
      description: '',
      parent_id: '',
      status: '',
      policy: '',
    });
    setAliases([]);
    setAliasInput('');
    setInfo('');
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
    };

    payload.description = form.description ? form.description : null;
    payload.parent_id = form.parent_id ? Number(form.parent_id) : null;
    payload.status = form.status ? form.status : null;
    payload.policy = form.policy ? form.policy : null;

    return payload;
  };

  const saveTag = async () => {
    if (!token) return;
    setError('');
    setInfo('');

    if (!form.name.trim() || !form.category.trim()) {
      setError('タグ名とカテゴリは必須です');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const endpoint = selectedId ? `/api/admin/tags/${selectedId}` : '/api/admin/tags';
      const method = selectedId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('タグの保存に失敗しました');
      }

      const data = await res.json().catch(() => ({}));
      await fetchTags();

      if (!selectedId && data?.id) {
        setSelectedId(data.id);
      }

      setInfo('保存しました');
    } catch (fetchError) {
      console.error('Error saving tag:', fetchError);
      setError('タグの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const deleteTag = async () => {
    if (!token || !selectedId) return;
    if (!window.confirm('選択中のタグを削除しますか？')) return;

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/tags/${selectedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('タグの削除に失敗しました');
      }

      await fetchTags();
      resetForm();
      setInfo('削除しました');
    } catch (fetchError) {
      console.error('Error deleting tag:', fetchError);
      setError('タグの削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const addAlias = async () => {
    if (!token || !selectedId) return;
    const trimmed = aliasInput.trim();
    if (!trimmed) return;

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/tags/${selectedId}/aliases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias: trimmed }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('エイリアス追加に失敗しました');
      }

      setAliases((prev) => Array.from(new Set([...prev, trimmed])));
      setAliasInput('');
      setInfo('エイリアスを追加しました');
    } catch (fetchError) {
      console.error('Error adding alias:', fetchError);
      setError('エイリアス追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const removeAlias = async (alias) => {
    if (!token || !selectedId) return;

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(`/api/admin/tags/${selectedId}/aliases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias, action: 'remove' }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('エイリアス削除に失敗しました');
      }

      setAliases((prev) => prev.filter((item) => item !== alias));
      setInfo('エイリアスを削除しました');
    } catch (fetchError) {
      console.error('Error removing alias:', fetchError);
      setError('エイリアス削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const rebuildClosure = async () => {
    if (!token) return;

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/admin/jobs/rebuild-tag-closure', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error('再計算ジョブの起動に失敗しました');
      }

      setInfo('再計算ジョブを起動しました');
    } catch (fetchError) {
      console.error('Error rebuilding closure:', fetchError);
      setError('再計算ジョブの起動に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = useMemo(() => (
    tags.filter((tag) => tag.id !== selectedId)
  ), [tags, selectedId]);

  const renderTree = (nodes, depth = 0) => (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            className={`w-full text-left px-2 py-1 rounded-md text-sm transition-colors ${
              selectedId === node.id
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => handleSelectTag(node.id)}
          >
            {node.name}
          </button>
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

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
          <h1 className="text-3xl font-bold text-gray-900">タグ編集</h1>
          <p className="text-sm text-gray-500 mt-1">
            タグの階層、エイリアス、ポリシーを管理します
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin" className="btn btn-secondary">
            ダッシュボード
          </Link>
          <button
            className="btn btn-secondary"
            onClick={fetchTags}
            disabled={loading}
          >
            再読み込み
          </button>
          <button
            className="btn btn-primary"
            onClick={rebuildClosure}
            disabled={saving}
          >
            closure再計算
          </button>
        </div>
      </div>

      {(error || info) && (
        <div className={`mb-4 text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
          {error || info}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">タグツリー</h2>
            <button
              className="btn btn-secondary text-sm"
              onClick={resetForm}
            >
              新規タグ
            </button>
          </div>
          {loading ? (
            <div className="text-gray-600">読み込み中...</div>
          ) : tags.length === 0 ? (
            <div className="text-gray-600">タグがありません</div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {Object.entries(treeByCategory).map(([category, nodes]) => (
                <div key={category}>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {category}
                  </div>
                  {renderTree(nodes)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedId ? `タグ編集: #${selectedId}` : '新規タグ作成'}
            </h2>
            {selectedId && (
              <div className="text-xs text-gray-500">
                作成日: {formatDateTime(tags.find((tag) => tag.id === selectedId)?.created_at)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タグ名</label>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
              <input
                type="text"
                list="category-options"
                className="input"
                value={form.category}
                onChange={(event) => handleFormChange('category', event.target.value)}
              />
              <datalist id="category-options">
                {categoryOptions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">親タグ</label>
              <select
                className="input"
                value={form.parent_id}
                onChange={(event) => handleFormChange('parent_id', event.target.value)}
              >
                <option value="">なし</option>
                {parentOptions.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
              <input
                type="text"
                className="input"
                value={form.status}
                onChange={(event) => handleFormChange('status', event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ポリシー</label>
              <input
                type="text"
                className="input"
                value={form.policy}
                onChange={(event) => handleFormChange('policy', event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea
                className="input h-24"
                value={form.description}
                onChange={(event) => handleFormChange('description', event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <button
              className="btn btn-primary"
              onClick={saveTag}
              disabled={saving}
            >
              {selectedId ? '更新' : '作成'}
            </button>
            {selectedId && (
              <button
                className="btn btn-secondary"
                onClick={deleteTag}
                disabled={saving}
              >
                削除
              </button>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">エイリアス</h3>
            {selectedId ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="エイリアスを追加"
                    value={aliasInput}
                    onChange={(event) => setAliasInput(event.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={addAlias}
                    disabled={saving}
                  >
                    追加
                  </button>
                </div>
                {aliases.length === 0 ? (
                  <div className="text-sm text-gray-500">エイリアスはありません</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {aliases.map((alias) => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {alias}
                        <button
                          type="button"
                          className="text-gray-500 hover:text-red-500"
                          onClick={() => removeAlias(alias)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">先にタグを選択してください</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TagEditor;
