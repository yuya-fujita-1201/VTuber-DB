import React from 'react';
import { Link } from 'react-router-dom';

const getSubscriberCount = (vtuber) =>
  vtuber?.youtube_subscribers ??
  vtuber?.youtube?.subscriber_count ??
  vtuber?.subscriber_count ??
  vtuber?.subscribers;

const getCommonTagCount = (vtuber) =>
  vtuber?.common_tag_count ??
  vtuber?.commonTagCount ??
  vtuber?.shared_tags_count ??
  vtuber?.sharedTagsCount ??
  (Array.isArray(vtuber?.common_tags) ? vtuber.common_tags.length : null) ??
  (Array.isArray(vtuber?.shared_tags) ? vtuber.shared_tags.length : null);

function SimilarVTubers({
  vtubers = [],
  className = '',
  title = '似ているVTuber',
  emptyMessage = '似ているVTuberは見つかりません',
}) {
  return (
    <div className={`card ${className}`.trim()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <span className="text-sm text-gray-500">{vtubers.length}人</span>
      </div>
      {vtubers.length === 0 ? (
        <p className="text-gray-600">{emptyMessage}</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {vtubers.map((vtuber) => {
            const subscribers = getSubscriberCount(vtuber);
            const commonTagCount = getCommonTagCount(vtuber);
            const avatarUrl = vtuber.avatar_url || vtuber.avatarUrl;
            const initial = vtuber.name ? vtuber.name.charAt(0) : '?';

            return (
              <Link
                key={vtuber.id}
                to={`/vtuber/${vtuber.id}`}
                className="min-w-[220px] w-60 flex-shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={vtuber.name}
                    className="w-full h-36 object-cover rounded-md mb-3"
                  />
                ) : (
                  <div className="w-full h-36 rounded-md mb-3 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-3xl font-semibold text-gray-500">
                    {initial}
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {vtuber.name}
                </h3>
                {vtuber.agency && (
                  <p className="text-sm text-gray-600 mb-2">{vtuber.agency}</p>
                )}
                {Number.isFinite(subscribers) && (
                  <p className="text-sm text-primary-600 mb-2">
                    {subscribers.toLocaleString()} 登録者
                  </p>
                )}
                {Number.isFinite(commonTagCount) && (
                  <div className="text-xs text-gray-500">
                    共通タグ: {commonTagCount}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SimilarVTubers;
