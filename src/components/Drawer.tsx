import { useState } from 'react';
import { CODE_SNIPPETS } from '../data/codeSnippets';
import { STICKERS, STAMPS, TAPE_COLORS } from '../data/stickers';
import type { ItemType } from '../types';

type Tab = 'code' | 'sticker' | 'stamp' | 'tape';
type Lang = 'js' | 'py';

interface Props {
  onDragStart: (type: ItemType, payload: Record<string, unknown>) => void;
  onAddCustomCode: (text: string, lang: Lang) => void;
}

/** 左侧素材抽屉：代码条 / 贴纸 / 印章 / 胶带 */
export default function Drawer({ onDragStart, onAddCustomCode }: Props) {
  const [tab, setTab] = useState<Tab>('code');
  // 自定义代码输入（受控）
  const [customLang, setCustomLang] = useState<Lang>('js');
  const [customText, setCustomText] = useState('');

  const dragAttrs = (type: ItemType, payload: Record<string, unknown>) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(
        'application/json',
        JSON.stringify({ type, payload }),
      );
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart(type, payload);
    },
  });

  const handleAddCustom = () => {
    const text = customText.trim();
    if (!text) return;
    onAddCustomCode(text, customLang);
    setCustomText('');
  };

  return (
    <div style={styles.drawer}>
      <div style={styles.header}>素材抽屉</div>

      <div style={styles.tabs}>
        {([
          ['code', '代码'],
          ['sticker', '贴纸'],
          ['stamp', '印章'],
          ['tape', '胶带'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              ...styles.tab,
              ...(tab === k ? styles.tabActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {tab === 'code' && (
          <>
            {/* 自定义代码输入卡片 */}
            <div style={styles.customCard}>
              <div style={styles.customTitle}>自己写一段</div>
              <div style={styles.langSwitch}>
                {(['js', 'py'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setCustomLang(l)}
                    style={{
                      ...styles.langBtn,
                      ...(customLang === l ? styles.langBtnActive : {}),
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={'// 粘贴或输入代码…'}
                style={styles.customTextarea}
                rows={4}
              />
              <div style={styles.customActions}>
                <button
                  style={styles.addBtn}
                  onClick={handleAddCustom}
                  disabled={!customText.trim()}
                >
                  贴到画布
                </button>
                {customText.trim() && (
                  <div
                    {...dragAttrs('code', { text: customText, lang: customLang })}
                    style={styles.dragHint}
                    title="或拖到画布上"
                  >
                    或拖我 →
                  </div>
                )}
              </div>
            </div>

            {CODE_SNIPPETS.map((s) => (
              <div key={s.id} {...dragAttrs('code', { text: s.text, lang: s.lang })} style={styles.codeChip}>
                <span style={styles.codeTag}>{s.lang.toUpperCase()}</span>
                <code style={styles.codeText}>{s.text.split('\n')[0]}</code>
              </div>
            ))}
          </>
        )}

        {tab === 'sticker' &&
          STICKERS.map((s) => (
            <div
              key={s.id}
              {...dragAttrs('sticker', { text: s.text, color: s.color })}
              style={{ ...styles.stickerChip, background: s.color }}
            >
              {s.text}
            </div>
          ))}

        {tab === 'stamp' &&
          STAMPS.map((s) => (
            <div
              key={s.id}
              {...dragAttrs('stamp', { text: s.text, color: s.color })}
              style={{ ...styles.stampChip, color: s.color, borderColor: s.color }}
            >
              {s.text}
            </div>
          ))}

        {tab === 'tape' &&
          TAPE_COLORS.map((c, i) => (
            <div
              key={i}
              {...dragAttrs('tape', { color: c })}
              style={{ ...styles.tapeChip, background: c }}
            />
          ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  drawer: {
    width: 230,
    height: '100%',
    background: 'rgba(255,253,247,0.92)',
    borderRight: '2px dashed rgba(120,100,60,0.3)',
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(4px)',
  },
  header: {
    padding: '16px 16px 10px',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ink)',
    borderBottom: '1px solid rgba(120,100,60,0.15)',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    padding: '10px 10px 0',
    flexWrap: 'wrap',
  },
  tab: {
    flex: '1 1 44%',
    border: 'none',
    background: 'transparent',
    padding: '7px 0',
    borderRadius: 6,
    fontSize: 16,
    fontFamily: 'var(--font-hand)',
    color: 'var(--ink-soft)',
  },
  tabActive: {
    background: 'var(--paper-2)',
    color: 'var(--ink)',
    fontWeight: 700,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  codeChip: {
    padding: '10px 12px',
    background: '#1e1e2e',
    borderRadius: 6,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    transition: 'transform 0.15s',
  },
  codeTag: {
    background: '#f0c674',
    color: '#1e1e2e',
    fontSize: 9,
    fontWeight: 700,
    padding: '2px 5px',
    borderRadius: 3,
    flexShrink: 0,
  },
  codeText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: '#e0def4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stickerChip: {
    padding: '12px',
    borderRadius: 4,
    textAlign: 'center',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'grab',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    filter: 'url(#torn-edge)',
  },
  stampChip: {
    padding: '10px',
    textAlign: 'center',
    fontFamily: 'var(--font-hand)',
    fontSize: 26,
    fontWeight: 700,
    border: '3px solid',
    borderRadius: 6,
    cursor: 'grab',
    background: 'transparent',
  },
  tapeChip: {
    height: 30,
    borderRadius: 2,
    cursor: 'grab',
    opacity: 0.7,
  },
  // 自定义代码卡片
  customCard: {
    background: 'var(--paper-2)',
    border: '2px dashed rgba(120,100,60,0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  customTitle: {
    fontFamily: 'var(--font-hand)',
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 8,
  },
  langSwitch: {
    display: 'flex',
    gap: 6,
    marginBottom: 8,
  },
  langBtn: {
    flex: 1,
    border: '1px solid rgba(120,100,60,0.3)',
    background: '#fffdf7',
    padding: '5px 0',
    borderRadius: 5,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--ink-soft)',
    cursor: 'pointer',
  },
  langBtnActive: {
    background: 'var(--ink)',
    color: '#fffdf7',
    borderColor: 'var(--ink)',
  },
  customTextarea: {
    width: '100%',
    background: '#1e1e2e',
    color: '#e0def4',
    border: 'none',
    borderRadius: 5,
    padding: 10,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    lineHeight: 1.5,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  customActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addBtn: {
    flex: 1,
    border: 'none',
    background: 'var(--user-a)',
    color: '#fff',
    padding: '8px 0',
    borderRadius: 6,
    fontFamily: 'var(--font-hand)',
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 0 #b94a3a',
  },
  dragHint: {
    fontSize: 12,
    color: 'var(--ink-soft)',
    fontFamily: 'var(--font-hand)',
    cursor: 'grab',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
};
