import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import type { CodeItem } from '../types';

/** 代码条：像从杂志剪下来的代码纸片，等宽字体，可双击编辑 */
export default function CodeStrip({ item }: { item: CodeItem }) {
  const { updateItem, editingId, setEditing } = useRoomStore();
  const [text, setText] = useState(item.text);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const editing = editingId === item.id;

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(null);
    if (text !== item.text) updateItem(item.id, { text }, true);
  };

  // 自适应高度
  const lineCount = text.split('\n').length;

  return (
    <div
      className="paper-cut"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(item.id);
      }}
      style={{
        padding: '14px 16px',
        minWidth: 200,
        maxWidth: 340,
        background: '#1e1e2e',
        color: '#e0def4',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: 1.55,
        boxShadow: 'var(--shadow-sticker)',
        position: 'relative',
        border: `2px solid ${item.lang === 'py' ? '#4caf50' : '#f0c674'}`,
      }}
    >
      {/* 语言小标 */}
      <span
        style={{
          position: 'absolute',
          top: -9,
          left: 10,
          background: item.lang === 'py' ? '#4caf50' : '#f0c674',
          color: '#1e1e2e',
          fontSize: 10,
          padding: '1px 8px',
          borderRadius: 4,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        {item.lang === 'py' ? 'PYTHON' : 'JS'}
      </span>

      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setText(item.text);
              setEditing(null);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e0def4',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.55,
            resize: 'none',
            minHeight: lineCount * 20,
          }}
          rows={lineCount}
        />
      ) : (
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {item.text}
        </pre>
      )}
    </div>
  );
}
