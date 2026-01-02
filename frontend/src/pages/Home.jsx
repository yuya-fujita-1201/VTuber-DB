import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Home() {
  const [stats, setStats] = useState(null);
  const [popularVTubers, setPopularVTubers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 統計情報取得
      const statsRes = await fetch('/api/search/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // 人気VTuber取得
      const vtuberRes = await fetch('/api/vtubers?limit=12&sort=subscribers');
      const vtuberData = await vtuberRes.json();
      setPopularVTubers(vtuberData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-xl text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          VTuber Database
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          VTuberの情報を検索・閲覧できるデータベース
        </p>
        <Link to="/search" className="btn btn-primary text-lg px-8 py-3">
          検索を開始
        </Link>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <div className="card text-center">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {stats.total_vtubers?.toLocaleString() || 0}
            </div>
            <div className="text-gray-600">VTuber</div>
          </div>
          <div className="card text-center">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {stats.total_agencies?.toLocaleString() || 0}
            </div>
            <div className="text-gray-600">事務所</div>
          </div>
          <div className="card text-center">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {(stats.total_youtube_subscribers / 1000000).toFixed(1)}M
            </div>
            <div className="text-gray-600">総登録者数</div>
          </div>
          <div className="card text-center">
            <div className="text-4xl font-bold text-primary-600 mb-2">
              {stats.total_tags?.toLocaleString() || 0}
            </div>
            <div className="text-gray-600">タグ</div>
          </div>
        </div>
      )}

      {/* Popular VTubers Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          人気のVTuber
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {popularVTubers.map((vtuber) => (
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
              {vtuber.youtube_subscribers && (
                <p className="text-sm text-primary-600">
                  {vtuber.youtube_subscribers.toLocaleString()} 登録者
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">高度な検索</h3>
          <p className="text-gray-600">
            名前、タグ、所属事務所、フォロワー数など様々な条件で検索できます
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-4">🏷️</div>
          <h3 className="text-xl font-semibold mb-2">AIタグづけ</h3>
          <p className="text-gray-600">
            AIが自動的にVTuberの特徴や属性をタグとして付与します
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">リアルタイム更新</h3>
          <p className="text-gray-600">
            YouTube、Twitter、Twitchから定期的にデータを更新します
          </p>
        </div>
      </div>
    </div>
  );
}

export default Home;
