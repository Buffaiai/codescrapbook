import { Fragment, useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import type { CodeItem, CodeTag } from '../types';

const TAG_STYLE: Record<CodeTag, { background: string; color: string }> = {
  Bug: { background: '#f8e3df', color: '#b2382b' },
  学到了: { background: '#e2f1e6', color: '#2f7d5b' },
  面试: { background: '#e4edf9', color: '#3b6fb5' },
};

/** 代码里的可断行符号：只在符号后允许换行，避免单词被从中间截断 */
const BREAK_SYMBOL_RE = /([(){}[\],;:.])/;
const isBreakSymbol = (s: string) => /^[(){}[\],;:.]$/.test(s);

function withBreakPoints(text: string) {
  return text.split(BREAK_SYMBOL_RE).map((part, i) =>
    isBreakSymbol(part) ? (
      <Fragment key={i}>
        {part}
        <wbr />
      </Fragment>
    ) : (
      part
    ),
  );
}

/** 代码条：像从杂志剪下来的代码纸片，等宽字体，可双击编辑 */
export default function CodeStrip({
  item,
  isSaved,
  onSaveTemplate,
}: {
  item: CodeItem;
  isSaved: boolean;
  onSaveTemplate: (item: CodeItem) => void;
}) {
  const updateItem = useRoomStore((s) => s.updateItem);
  const editingId = useRoomStore((s) => s.editingId);
  const setEditing = useRoomStore((s) => s.setEditing);
  const [text, setText] = useState(item.text);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const editing = editingId === item.id;

  useEffect(() => {
    if (editing) {
      setText(item.text);
      requestAnimationFrame(() => {
        taRef.current?.focus();
        taRef.current?.select();
      });
    }
  }, [editing, item.text]);

  const commit = () => {
    setEditing(null);
    if (text !== item.text) updateItem(item.id, { text });
  };

  const lineCount = Math.max(1, text.split('\n').length);

  return (
    <div
      className="paper-cut"
      data-testid="code-card"
      data-code-item-id={item.id}
      onPointerDown={(e) => {
        if (editing) e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(item.id);
      }}
      style={{
        padding: '14px 16px',
        minWidth: 200,
        maxWidth: 340,
        maxHeight: 520,
        overflowY: 'auto',
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

      <button
        type="button"
        aria-label={isSaved ? '已存为我的模板' : '存为我的模板'}
        title={isSaved ? '已存为我的模板' : '存为我的模板'}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onSaveTemplate(item);
        }}
        style={{
          position: 'absolute',
          top: -12,
          right: 18,
          width: 26,
          height: 26,
          padding: 0,
          border: '1px solid #d5b45e',
          borderRadius: '50%',
          background: isSaved ? '#f0c674' : '#fffdf7',
          color: '#8a6817',
          fontSize: 17,
          lineHeight: '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 2,
        }}
      >
        {isSaved ? '★' : '☆'}
      </button>

      {editing ? (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onPointerDown={(e) => e.stopPropagation()}
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
          autoFocus
        />
      ) : (
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'normal',
            overflowWrap: 'break-word',
          }}
        >
          {withBreakPoints(item.text)}
        </pre>
      )}

      {(item.note || item.tag) && (
        <div
          data-testid="code-card-meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 7,
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px dashed rgba(224,222,244,0.28)',
          }}
        >
          {item.note && (
            <span
              style={{
                flex: '1 1 140px',
                color: '#fff3d1',
                fontFamily: 'var(--font-hand)',
                fontSize: 16,
                lineHeight: 1.35,
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.note}
            </span>
          )}
          {item.tag && (
            <span
              data-testid="code-card-tag"
              style={{
                ...TAG_STYLE[item.tag],
                padding: '2px 8px',
                borderRadius: 10,
                fontFamily: 'var(--font-hand)',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {item.tag}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
