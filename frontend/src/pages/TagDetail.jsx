import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import TagRelations from '../components/TagRelations';

function TagDetail() {
  const { id } = useParams();
  const [tagData, setTagData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTag();
  }, [id]);

  const fetchTag = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tags/${id}`);
      const data = await res.json();
      setTagData(data);
    } catch (error) {
      console.error('Error fetching tag:', error);
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

  if (!tagData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            タグが見つかりません
          </h1>
          <Link to="/tags" className="btn btn-primary">
            タグ一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {tagData.tag.name}
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              カテゴリ: {tagData.tag.category}
            </p>
            {tagData.tag.description && (
              <p className="text-gray-700">{tagData.tag.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary-600">
              {tagData.count}
            </div>
            <div className="text-gray-600">VTuber</div>
          </div>
        </div>
      </div>

      {/* Related Tags */}
      {tagData.tag.related_tags && tagData.tag.related_tags.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            関連タグ
          </h2>
          <TagRelations relations={tagData.tag.related_tags} />
        </div>
      )}

      {/* VTubers with this tag */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          このタグを持つVTuber
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tagData.vtubers.map((vtuber) => (
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
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>信頼度: {(vtuber.confidence * 100).toFixed(0)}%</span>
                {vtuber.is_verified ? (
                  <span className="text-green-600">✓ 承認済み</span>
                ) : (
                  <span className="text-gray-400">未承認</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TagDetail;
