import React, { useMemo } from 'react';

const platformMeta = {
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    accent: 'text-red-600',
    border: 'border-red-300',
    bg: 'bg-red-50',
  },
  twitter: {
    label: 'Twitter/X',
    icon: '🐦',
    accent: 'text-blue-600',
    border: 'border-blue-300',
    bg: 'bg-blue-50',
  },
  official: {
    label: '公式サイト',
    icon: '🌐',
    accent: 'text-green-600',
    border: 'border-green-300',
    bg: 'bg-green-50',
  },
  other: {
    label: 'その他',
    icon: '🔗',
    accent: 'text-gray-600',
    border: 'border-gray-300',
    bg: 'bg-gray-50',
  },
};

const normalizePlatform = (platform) => {
  if (!platform) return 'other';
  const raw = platform.toString().toLowerCase();
  if (raw.includes('youtube') || raw === 'yt') return 'youtube';
  if (raw.includes('twitter') || raw === 'x') return 'twitter';
  if (raw.includes('official') || raw.includes('website') || raw.includes('site') || raw.includes('hp')) {
    return 'official';
  }
  return 'other';
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ja-JP');
};

function EvidenceDisplay({ evidence = [], className = '', emptyMessage = '根拠が見つかりません' }) {
  const grouped = useMemo(() => {
    return (evidence || []).reduce((acc, item) => {
      const key = normalizePlatform(item.platform);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [evidence]);

  const entries = Object.entries(grouped);
  const order = ['youtube', 'twitter', 'official', 'other'];
  entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

  if (!entries.length) {
    return (
      <div className={`card ${className}`.trim()}>
        <p className="text-gray-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`card ${className}`.trim()}>
      <div className="space-y-6">
        {entries.map(([platformKey, items]) => {
          const meta = platformMeta[platformKey] || platformMeta.other;
          return (
            <div key={platformKey} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-xl ${meta.accent}`} aria-hidden="true">
                  {meta.icon}
                </span>
                <h3 className="text-lg font-semibold text-gray-900">{meta.label}</h3>
                <span className="text-xs text-gray-500">{items.length}件</span>
              </div>
              <div className="space-y-3">
                {items.map((item) => {
                  const snippet = item.snippet || item.excerpt || item.text || 'スニペットがありません';
                  const dateLabel = formatDate(item.published_at || item.created_at);
                  return (
                    <blockquote
                      key={item.id || `${platformKey}-${item.url || snippet}`}
                      className={`border-l-4 ${meta.border} ${meta.bg} rounded-r-lg px-4 py-3`}
                    >
                      <p className="text-sm text-gray-700 leading-relaxed">{snippet}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {item.source_title && <span>{item.source_title}</span>}
                        {dateLabel && <span>{dateLabel}</span>}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700"
                          >
                            元のコンテンツ
                          </a>
                        )}
                      </div>
                    </blockquote>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EvidenceDisplay;
