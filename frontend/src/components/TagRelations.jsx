import React from 'react';
import { Link } from 'react-router-dom';

const relationTypeMeta = {
  cooccurrence: {
    label: '共起',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  sibling: {
    label: '兄弟',
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
  opposite: {
    label: '対立',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  bridge: {
    label: '橋渡し',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  unknown: {
    label: '関連',
    badge: 'bg-gray-50 text-gray-700 border-gray-200',
  },
};

const normalizeRelationType = (type) => {
  if (!type) return 'unknown';
  const raw = type.toString();
  if (raw.includes('共起') || raw.includes('共現')) return 'cooccurrence';
  if (raw.includes('兄弟') || raw.includes('同階層') || raw.includes('類似')) return 'sibling';
  if (raw.includes('対立') || raw.includes('反対')) return 'opposite';
  if (raw.includes('橋渡し') || raw.includes('ブリッジ')) return 'bridge';

  const normalized = raw.toLowerCase();
  if (['cooccurrence', 'co-occur', 'cooccur', 'co_occur'].some((v) => normalized.includes(v))) {
    return 'cooccurrence';
  }
  if (['sibling', 'peer', 'family'].some((v) => normalized.includes(v))) return 'sibling';
  if (['opposite', 'contrast', 'antonym'].some((v) => normalized.includes(v))) return 'opposite';
  if (['bridge', 'connector'].some((v) => normalized.includes(v))) return 'bridge';
  return 'unknown';
};

const formatWeight = (weight) => {
  if (!Number.isFinite(weight)) return null;
  if (weight <= 1) return `${Math.round(weight * 100)}%`;
  return weight.toFixed(2);
};

const getEmphasisClass = (weight) => {
  if (!Number.isFinite(weight)) return 'border-gray-200';
  if (weight >= 0.75) return 'border-primary-300 bg-primary-50';
  if (weight >= 0.5) return 'border-gray-300';
  return 'border-gray-200 opacity-90';
};

const getRelationKey = (relation) =>
  relation?.id ?? relation?.tag_id ?? relation?.tag?.id ?? relation?.name;

function TagRelations({ relations = [], className = '', emptyMessage = '関連タグはありません' }) {
  if (!relations || relations.length === 0) {
    return (
      <div className={`card ${className}`.trim()}>
        <p className="text-gray-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`card ${className}`.trim()}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {relations.map((relation) => {
          const relationTypeKey = normalizeRelationType(relation.relation_type || relation.type);
          const meta = relationTypeMeta[relationTypeKey] || relationTypeMeta.unknown;
          const weight = Number.isFinite(relation.weight) ? relation.weight : null;
          const weightLabel = formatWeight(weight);
          const tagName = relation.tag?.name || relation.tag_name || relation.name || '不明なタグ';
          const tagId = relation.tag_id ?? relation.tag?.id ?? relation.id;
          const emphasisClass = getEmphasisClass(weight);

          const content = (
            <div className={`rounded-lg border p-4 transition-shadow hover:shadow-md ${emphasisClass}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{tagName}</h3>
                {weightLabel && (
                  <span className="text-xs font-semibold text-primary-600">{weightLabel}</span>
                )}
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${meta.badge}`}
              >
                {meta.label}
              </span>
              {relation.description && (
                <p className="text-sm text-gray-600 mt-3">{relation.description}</p>
              )}
            </div>
          );

          if (tagId) {
            return (
              <Link
                key={getRelationKey(relation)}
                to={`/tags/${tagId}`}
                className="block"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={getRelationKey(relation)} className="block">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TagRelations;
