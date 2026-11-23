import { useRoomStore } from '../store/useRoomStore';

/** 轻量提示条：用于复制房号、导出、撤销删除等关键操作反馈 */
export default function Toast() {
  const toast = useRoomStore((s) => s.toast);
  const dismiss = useRoomStore((s) => s.dismissToast);
  if (!toast) return null;

  return (
    <div data-ui-hide style={styles.wrap}>
      <div
        style={{
          ...styles.toast,
          background: toast.kind === 'error' ? '#8f2f24' : '#2f2a22',
        }}
      >
        <span style={styles.text}>{toast.text}</span>
        {toast.actionLabel && (
          <button
            style={styles.action}
            onClick={() => {
              toast.onAction?.();
              dismiss();
            }}
          >
            {toast.actionLabel}
          </button>
        )}
        <button style={styles.close} onClick={dismiss} aria-label="关闭提示">
          ×
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed',
    left: '50%',
    bottom: 28,
    transform: 'translateX(-50%)',
    zIndex: 300,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px 10px 18px',
    borderRadius: 8,
    color: '#fffdf7',
    fontFamily: 'var(--font-hand)',
    fontSize: 17,
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
    pointerEvents: 'auto',
    animation: 'float-in 0.2s ease-out',
    maxWidth: '90vw',
  },
  text: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  action: {
    border: 'none',
    background: '#f0c674',
    color: '#2f2a22',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  close: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
    flexShrink: 0,
  },
};
