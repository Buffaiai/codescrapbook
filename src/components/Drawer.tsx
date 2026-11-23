import { useState } from 'react';
import {
  CODE_SNIPPET_GROUPS,
  type CodeSnippet,
} from '../data/codeSnippets';
import { STICKERS, STAMPS, TAPE_COLORS } from '../data/stickers';
import type { CodeTag, ItemType } from '../types';

type Tab = 'code' | 'sticker' | 'stamp' | 'tape';
type Lang = 'js' | 'py';

const CODE_TAGS: CodeTag[] = ['Bug', '学到了', '面试'];

interface Props {
  open?: boolean;
  customTemplates: CodeSnippet[];
  onDragStart: (type: ItemType, payload: Record<string, unknown>) => void;
  onAdd: (type: ItemType, payload: Record<string, unknown>) => void;
  onAddCustomCode: (
    text: string,
    lang: Lang,
    note: string,
    tag?: CodeTag,
  ) => void;
}

/** 左侧素材抽屉：代码条 / 贴纸 / 印章 / 胶带 */
export default function Drawer({
  open = false,
  customTemplates,
  onDragStart,
  onAdd,
  onAddCustomCode,
}: Props) {
  const [tab, setTab] = useState<Tab>('code');
  const [customLang, setCustomLang] = useState<Lang>('js');
  const [customText, setCustomText] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customTag, setCustomTag] = useState<CodeTag>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    onAddCustomCode(text, customLang, customNote.trim(), customTag);
    setCustomText('');
    setCustomNote('');
    setCustomTag(undefined);
  };

  const renderPreset = (snippet: CodeSnippet) => {
    const expanded = expandedId === snippet.id;
    const payload = {
      text: snippet.text,
      lang: snippet.lang,
      note: snippet.note,
      tag: snippet.tag,
    };
    return (
      <div
        key={snippet.id}
        data-preset-id={snippet.id}
        style={styles.presetCard}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedId(expanded ? null : snippet.id)}
          style={styles.presetHeader}
        >
          <span style={styles.presetTitle}>{snippet.title}</span>
          <span style={styles.expandIcon}>{expanded ? '−' : '+'}</span>
        </button>
        <div style={styles.presetReason}>{snippet.reason}</div>
        {expanded && (
          <>
            {(snippet.note || snippet.tag) && (
              <div style={styles.savedMeta}>
                {snippet.note && <span>{snippet.note}</span>}
                {snippet.tag && <span style={styles.savedTag}>{snippet.tag}</span>}
              </div>
            )}
            <pre style={styles.presetCode}>{snippet.text}</pre>
          </>
        )}
        <div style={styles.presetActions}>
          <span style={styles.presetLang}>
            {snippet.lang.toUpperCase()} · {snippet.text.split('\n').length} 行
          </span>
          <button
            type="button"
            style={styles.presetAddBtn}
            onClick={() => onAdd('code', payload)}
          >
            贴到画布
          </button>
          <span
            {...dragAttrs('code', payload)}
            style={styles.presetDrag}
            title="拖到画布"
          >
            拖
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={`sb-drawer${open ? ' sb-open' : ''}`} style={styles.drawer}>
      <div style={styles.header}>
        素材抽屉
        <div style={styles.headerHint}>点击贴上，也可拖到画布</div>
      </div>

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
            <div style={styles.customCard} data-testid="custom-code-editor">
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
                aria-label="代码内容"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={
                  customLang === 'py'
                    ? '# 粘贴或输入代码…'
                    : '// 粘贴或输入代码…'
                }
                style={styles.customTextarea}
                rows={4}
              />
              <input
                aria-label="一句话备注"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="一句话备注，如：修了登录闪退的 bug"
                style={styles.customNoteInput}
                maxLength={60}
              />
              <div style={styles.tagRow} aria-label="代码标签">
                {CODE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={customTag === tag}
                    onClick={() =>
                      setCustomTag(customTag === tag ? undefined : tag)
                    }
                    style={{
                      ...styles.tagBtn,
                      ...(customTag === tag ? styles.tagBtnActive : {}),
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div style={styles.customActions}>
                <button
                  style={{
                    ...styles.addBtn,
                    opacity: customText.trim() ? 1 : 0.5,
                  }}
                  onClick={handleAddCustom}
                  disabled={!customText.trim()}
                >
                  贴到画布
                </button>
                {customText.trim() && (
                  <div
                    {...dragAttrs('code', {
                      text: customText.trim(),
                      lang: customLang,
                      note: customNote.trim(),
                      tag: customTag,
                    })}
                    style={styles.dragHint}
                    title="或拖到画布上"
                  >
                    或拖我 →
                  </div>
                )}
              </div>
            </div>

            {customTemplates.length > 0 && (
              <section style={styles.presetGroup}>
                <div style={styles.groupTitle}>
                  我的模板 <span>{customTemplates.length}</span>
                </div>
                {customTemplates.map(renderPreset)}
              </section>
            )}

            {CODE_SNIPPET_GROUPS.map((group) => (
              <section key={group.id} style={styles.presetGroup}>
                <div style={styles.groupTitle}>{group.title}</div>
                {group.snippets.map(renderPreset)}
              </section>
            ))}
          </>
        )}

        {tab === 'sticker' &&
          STICKERS.map((s) => (
            <div
              key={s.id}
              {...dragAttrs('sticker', { text: s.text, color: s.color })}
              onClick={() => onAdd('sticker', { text: s.text, color: s.color })}
              style={{ ...styles.stickerChip, background: s.color }}
              title="点击贴到画布，也可拖拽"
            >
              {s.text}
            </div>
          ))}

        {tab === 'stamp' &&
          STAMPS.map((s) => (
            <div
              key={s.id}
              {...dragAttrs('stamp', {
                text: s.text,
                color: s.color,
              })}
              onClick={() =>
                onAdd('stamp', { text: s.text, color: s.color })
              }
              style={{
                ...styles.stampChip,
                color: s.color,
                borderColor: s.color,
              }}
              title="点击贴到画布，也可拖拽"
            >
              {s.text}
            </div>
          ))}

        {tab === 'tape' &&
          TAPE_COLORS.map((t) => (
            <div
              key={t.name}
              {...dragAttrs('tape', { color: t.color })}
              onClick={() => onAdd('tape', { color: t.color })}
              style={{ ...styles.tapeChip, background: t.color }}
              title={`${t.name}胶带 · 点击贴上，也可拖拽`}
            >
              <span style={styles.tapeName}>{t.name}</span>
            </div>
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
    flexShrink: 0,
  },
  header: {
    padding: '16px 16px 10px',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--ink)',
    borderBottom: '1px solid rgba(120,100,60,0.15)',
  },
  headerHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 400,
    color: 'var(--ink-soft)',
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
    gap: 12,
  },
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
  customNoteInput: {
    width: '100%',
    marginTop: 8,
    padding: '7px 9px',
    border: '1px solid rgba(120,100,60,0.3)',
    borderRadius: 5,
    background: '#fffdf7',
    color: 'var(--ink)',
    outline: 'none',
    fontFamily: 'var(--font-hand)',
    fontSize: 14,
  },
  tagRow: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  tagBtn: {
    flex: 1,
    padding: '4px 3px',
    border: '1px solid rgba(120,100,60,0.28)',
    borderRadius: 10,
    background: '#fffdf7',
    color: 'var(--ink-soft)',
    fontSize: 12,
    fontFamily: 'var(--font-hand)',
  },
  tagBtnActive: {
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
    color: '#fffdf7',
    fontWeight: 700,
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
  presetGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 2px',
    color: 'var(--ink)',
    fontFamily: 'var(--font-hand)',
    fontSize: 17,
    fontWeight: 700,
  },
  presetCard: {
    padding: 10,
    border: '1px solid rgba(120,100,60,0.22)',
    borderRadius: 7,
    background: '#fffdf7',
    boxShadow: '0 1px 3px rgba(60,45,20,0.08)',
  },
  presetHeader: {
    width: '100%',
    padding: 0,
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'var(--ink)',
    textAlign: 'left',
  },
  presetTitle: {
    fontFamily: 'var(--font-hand)',
    fontSize: 17,
    fontWeight: 700,
  },
  expandIcon: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--paper-2)',
    textAlign: 'center',
    lineHeight: '18px',
    fontFamily: 'var(--font-mono)',
    fontSize: 15,
  },
  presetReason: {
    marginTop: 5,
    color: 'var(--ink-soft)',
    fontFamily: 'var(--font-hand)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  presetCode: {
    margin: '8px 0 0',
    padding: 9,
    maxHeight: 260,
    overflow: 'auto',
    borderRadius: 5,
    background: '#1e1e2e',
    color: '#e0def4',
    fontFamily: 'var(--font-mono)',
    fontSize: 10.5,
    lineHeight: 1.5,
    whiteSpace: 'pre',
    userSelect: 'text',
  },
  savedMeta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
    color: 'var(--ink)',
    fontSize: 13,
  },
  savedTag: {
    padding: '1px 6px',
    borderRadius: 8,
    background: '#f8e3df',
    color: '#b2382b',
    fontSize: 11,
  },
  presetActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  presetLang: {
    marginRight: 'auto',
    color: 'var(--ink-soft)',
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
  },
  presetAddBtn: {
    padding: '4px 8px',
    border: 'none',
    borderRadius: 5,
    background: 'var(--user-a)',
    color: '#fff',
    fontFamily: 'var(--font-hand)',
    fontSize: 13,
    fontWeight: 700,
  },
  presetDrag: {
    color: 'var(--ink-soft)',
    fontSize: 12,
    cursor: 'grab',
    userSelect: 'none',
  },
  stickerChip: {
    padding: '12px',
    borderRadius: 4,
    textAlign: 'center',
    fontFamily: 'var(--font-hand)',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
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
    cursor: 'pointer',
    background: 'transparent',
  },
  tapeChip: {
    height: 34,
    borderRadius: 2,
    cursor: 'pointer',
    opacity: 0.75,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapeName: {
    fontSize: 12,
    color: '#3a3226',
    fontFamily: 'var(--font-hand)',
    fontWeight: 700,
    opacity: 0.85,
  },
};
