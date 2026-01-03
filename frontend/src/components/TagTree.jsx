import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const INDENT_PX = 16;

const getTagCount = (node) => {
  const count =
    node?.vtuber_count ??
    node?.vtuberCount ??
    node?.count ??
    node?.vtuber_total ??
    node?.total;
  return Number.isFinite(count) ? count : null;
};

const getNodeKey = (node) => node?.id ?? node?.tag_id ?? node?.name;

function TagTreeNode({ node, level, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const children = Array.isArray(node?.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const count = getTagCount(node);
  const tagId = node?.id ?? node?.tag_id;

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: level * INDENT_PX }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? '折りたたむ' : '展開する'}
            aria-expanded={expanded}
            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700"
          >
            <span className="text-sm">{expanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <span className="w-5 h-5" aria-hidden="true" />
        )}
        {tagId ? (
          <Link
            to={`/tags/${tagId}`}
            className="font-medium text-gray-900 hover:text-primary-600"
          >
            {node.name}
          </Link>
        ) : (
          <span className="font-medium text-gray-900">{node.name}</span>
        )}
        <span className="text-xs text-gray-500">
          {count !== null ? `${count.toLocaleString()} VTuber` : 'VTuber数不明'}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="space-y-2">
          {children.map((child) => (
            <TagTreeNode
              key={getNodeKey(child)}
              node={child}
              level={level + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TagTree({ tags = [], defaultExpanded = true, className = '', emptyMessage = 'タグがありません' }) {
  if (!tags || tags.length === 0) {
    return (
      <div className={`card ${className}`.trim()}>
        <p className="text-gray-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`card ${className}`.trim()}>
      <div className="space-y-3">
        {tags.map((tag) => (
          <TagTreeNode
            key={getNodeKey(tag)}
            node={tag}
            level={0}
            defaultExpanded={defaultExpanded}
          />
        ))}
      </div>
    </div>
  );
}

export default TagTree;
