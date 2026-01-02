import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Search() {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [agency, setAgency] = useState('');
  const [minSubscribers, setMinSubscribers] = useState('');
  const [maxSubscribers, setMaxSubscribers] = useState('');
  const [sort, setSort] = useState('subscribers');

  const [results, setResults] = useState([]);
  const [tags, setTags] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTags();
    fetchAgencies();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tags`);
      const data = await res.json();
      setTags(data.data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchAgencies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/search/agencies`);
      const data = await res.json();
      setAgencies(data.data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));
      if (agency) params.append('agency', agency);
      if (minSubscribers) params.append('min_subscribers', minSubscribers);
      if (maxSubscribers) params.append('max_subscribers', maxSubscribers);
      params.append('sort', sort);
      params.append('limit', '50');

      const res = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">VTuber検索</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Search Filters */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <h2 className="text-xl font-semibold mb-4">検索条件</h2>

            {/* Keyword Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                キーワード
              </label>
              <input
                type="text"
                className="input"
                placeholder="名前で検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Agency Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                所属事務所
              </label>
              <select
                className="input"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
              >
                <option value="">すべて</option>
                {agencies.map((ag) => (
                  <option key={ag.agency} value={ag.agency}>
                    {ag.agency} ({ag.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Subscriber Count Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                登録者数
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  className="input"
                  placeholder="最小"
                  value={minSubscribers}
                  onChange={(e) => setMinSubscribers(e.target.value)}
                />
                <input
                  type="number"
                  className="input"
                  placeholder="最大"
                  value={maxSubscribers}
                  onChange={(e) => setMaxSubscribers(e.target.value)}
                />
              </div>
            </div>

            {/* Sort */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                並び順
              </label>
              <select
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="subscribers">登録者数</option>
                <option value="followers">フォロワー数</option>
                <option value="name">名前</option>
                <option value="debut">デビュー日</option>
              </select>
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                タグ
              </label>
              <div className="max-h-96 overflow-y-auto">
                {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                  <div key={category} className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {categoryTags.map((tag) => (
                        <label key={tag.id} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={selectedTags.includes(tag.id)}
                            onChange={() => toggleTag(tag.id)}
                          />
                          <span className="text-sm">{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary w-full"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? '検索中...' : '検索'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">検索中...</div>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="mb-4 text-gray-600">
                {results.length}件の結果
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((vtuber) => (
                  <Link
                    key={vtuber.id}
                    to={`/vtuber/${vtuber.id}`}
                    className="card hover:shadow-lg transition-shadow duration-200"
                  >
                    {vtuber.avatar_url && (
                      <img
                        src={vtuber.avatar_url}
                        alt={vtuber.name}
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {vtuber.name}
                    </h3>
                    {vtuber.agency && (
                      <p className="text-sm text-gray-600 mb-2">{vtuber.agency}</p>
                    )}
                    <div className="flex justify-between text-sm">
                      {vtuber.youtube_subscribers && (
                        <span className="text-primary-600">
                          📺 {vtuber.youtube_subscribers.toLocaleString()}
                        </span>
                      )}

                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">
                検索条件を設定して検索してください
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Search;
