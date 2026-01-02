import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function VTuberDetail() {
  const { id } = useParams();
  const [vtuber, setVTuber] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVTuber();
  }, [id]);

  const fetchVTuber = async () => {
    try {
      const res = await fetch(`/api/vtubers/${id}`);
      const data = await res.json();
      setVTuber(data);
    } catch (error) {
      console.error('Error fetching vtuber:', error);
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

  if (!vtuber) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            VTuberが見つかりません
          </h1>
          <Link to="/search" className="btn btn-primary">
            検索に戻る
          </Link>
        </div>
      </div>
    );
  }

  const tagsByCategory = (vtuber.tags || []).reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-8">
          {vtuber.avatar_url && (
            <img
              src={vtuber.avatar_url}
              alt={vtuber.name}
              className="w-full md:w-64 h-64 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {vtuber.name}
            </h1>
            {vtuber.name_en && (
              <p className="text-xl text-gray-600 mb-4">{vtuber.name_en}</p>
            )}
            {vtuber.agency && (
              <p className="text-lg text-gray-700 mb-4">
                所属: <span className="font-semibold">{vtuber.agency}</span>
              </p>
            )}
            {vtuber.debut_date && (
              <p className="text-gray-600 mb-4">
                デビュー日: {new Date(vtuber.debut_date).toLocaleDateString('ja-JP')}
              </p>
            )}
            {vtuber.description && (
              <p className="text-gray-700 mb-4">{vtuber.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Social Media Stats */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ソーシャルメディア
            </h2>
            <div className="space-y-4">
              {vtuber.youtube && (
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">YouTube</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {vtuber.youtube.channel_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">
                      {vtuber.youtube.subscriber_count?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-gray-600">登録者</div>
                  </div>
                </div>
              )}
              {vtuber.twitter && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Twitter/X</div>
                    <div className="text-xl font-semibold text-gray-900">
                      @{vtuber.twitter.username}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {vtuber.twitter.follower_count?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-gray-600">フォロワー</div>
                  </div>
                </div>
              )}
              {vtuber.twitch && (
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-600">Twitch</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {vtuber.twitch.channel_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {vtuber.twitch.follower_count?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-gray-600">フォロワー</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Streams */}
          {vtuber.recent_streams && vtuber.recent_streams.length > 0 && (
            <div className="card">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                最近の配信
              </h2>
              <div className="space-y-4">
                {vtuber.recent_streams.slice(0, 5).map((stream) => (
                  <div key={stream.id} className="border-b pb-4 last:border-b-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {stream.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(stream.scheduled_start_time).toLocaleString('ja-JP')}
                    </p>
                    {stream.viewer_count && (
                      <p className="text-sm text-gray-600">
                        視聴者数: {stream.viewer_count.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* Tags */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">タグ</h2>
            {Object.entries(tagsByCategory).map(([category, tags]) => (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.id}`}
                      className={`px-3 py-1 rounded-full text-sm ${
                        tag.is_verified
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tag.name}
                      {!tag.is_verified && ' *'}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {vtuber.tags && vtuber.tags.length === 0 && (
              <p className="text-gray-600">タグはまだありません</p>
            )}
            <p className="text-xs text-gray-500 mt-4">
              * 未承認のAI生成タグ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VTuberDetail;
