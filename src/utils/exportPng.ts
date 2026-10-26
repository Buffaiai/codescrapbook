import { toPng } from 'html-to-image';

/** 把画布导出为 PNG 并下载 */
export async function exportPng(node: HTMLElement, filename = 'code-scrap.png') {
  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: '#f5efdf',
      cacheBust: true,
      // 跳过操作手柄、选中框等 UI 层（它们有 data-ui 属性）
      filter: (el) => {
        if (!(el instanceof HTMLElement)) return true;
        return !el.hasAttribute('data-ui-hide');
      },
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('导出失败', err);
    alert('导出失败，请重试');
  }
}
