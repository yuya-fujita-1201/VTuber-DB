import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function TagList() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tags`);
      const data = await res.json();
      setTags(data.grouped || {});
    } catch (error) {
      console.error('Error fetching tags:', error);
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
      <h1 className="text-4xl font-bold text-gray-900 mb-8">タグ一覧</h1>

      <div className="space-y-8">
        {Object.entries(tags).map(([category, categoryTags]) => (
          <div key={category} className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 capitalize">
              {category}
            </h2>
            <div className="flex flex-wrap gap-3">
              {categoryTags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tags/${tag.id}`}
                  className="px-4 py-2 bg-primary-100 text-primary-800 rounded-full hover:bg-primary-200 transition-colors"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TagList;
