import type { CodeTag } from '../types';

export interface CodeSnippet {
  id: string;
  title: string;
  text: string;
  lang: 'js' | 'py';
  reason: string;
  note?: string;
  tag?: CodeTag;
}

export interface CodeSnippetGroup {
  id: string;
  title: string;
  snippets: CodeSnippet[];
}

export const CODE_SNIPPET_GROUPS: CodeSnippetGroup[] = [
  {
    id: 'interview',
    title: '面试手写',
    snippets: [
      {
        id: 'debounce',
        title: '防抖',
        lang: 'js',
        reason: '搜索框、窗口缩放都用得上，能讲清 this 和定时器更加分。',
        text: `function debounce(fn, wait = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args); // 延迟执行，并保留 this 和参数
    }, wait);
  };
}`,
      },
      {
        id: 'throttle',
        title: '节流',
        lang: 'js',
        reason: '滚动和拖拽场景最常见，别再把节流和防抖混为一谈。',
        text: `function throttle(fn, wait = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args); // 每个时间窗口只执行一次
    }
  };
}`,
      },
      {
        id: 'deep-clone',
        title: '深拷贝',
        lang: 'js',
        reason: '不仅考递归，还能检查你有没有考虑循环引用。',
        text: `function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value); // 循环引用直接复用副本
  const result = Array.isArray(value) ? [] : {};
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    result[key] = deepClone(value[key], seen);
  }
  return result;
}`,
      },
    ],
  },
  {
    id: 'daily',
    title: '日常高频',
    snippets: [
      {
        id: 'unique-by-id',
        title: '数组去重',
        lang: 'js',
        reason: '接口合并数据时经常按 id 去重，比只处理数字更实用。',
        text: `const uniqueById = (list) => [
  ...new Map(list.map((item) => [item.id, item])).values(),
]; // 按 id 去重，相同 id 保留最后一条`,
      },
      {
        id: 'request-wrapper',
        title: '请求封装',
        lang: 'js',
        reason: '统一补请求头、检查 HTTP 状态，业务代码不用重复写样板。',
        text: `async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
  return response.json(); // 统一处理非 2xx，再返回 JSON
}`,
      },
      {
        id: 'format-date',
        title: '日期格式化',
        lang: 'js',
        reason: '月份从 0 开始、个位数补零，都是日常最容易漏掉的细节。',
        text: `function formatDate(input) {
  const date = new Date(input);
  const pad = (n) => String(n).padStart(2, '0');
  const day = \`\${date.getFullYear()}-\${pad(date.getMonth() + 1)}-\${pad(date.getDate())}\`;
  const time = \`\${pad(date.getHours())}:\${pad(date.getMinutes())}\`;
  return \`\${day} \${time}\`; // 输出本地时间，如 2026-11-23 14:30
}`,
      },
    ],
  },
  {
    id: 'pitfalls',
    title: '容易抄错',
    snippets: [
      {
        id: 'effect-dependencies',
        title: 'useEffect 依赖',
        lang: 'js',
        reason: '依赖漏写会拿到旧数据，顺手带上清理逻辑才完整。',
        text: `useEffect(() => {
  let ignore = false;
  async function loadUser() {
    const user = await fetchUser(userId);
    if (!ignore) setUser(user);
  }
  loadUser();
  return () => {
    ignore = true; // userId 变化后，忽略旧请求的结果
  };
}, [userId]);`,
      },
      {
        id: 'closure-loop',
        title: '闭包',
        lang: 'js',
        reason: '循环绑定事件的经典坑，用 let 才能留住每次的索引。',
        text: `const buttons = document.querySelectorAll('button');
for (let index = 0; index < buttons.length; index += 1) {
  buttons[index].addEventListener('click', () => {
    console.log(index); // let 为每轮循环保留独立的 index
  });
}`,
      },
      {
        id: 'async-order',
        title: '异步顺序',
        lang: 'js',
        reason: '独立请求该并行就并行，别让连续的 await 白白拖慢页面。',
        text: `async function loadDashboard() {
  try {
    const [user, orders] = await Promise.all([
      fetchUser(),
      fetchOrders(),
    ]);
    render({ user, orders }); // 并行请求，全部完成后再渲染
  } catch (error) {
    showError(error);
  }
}`,
      },
    ],
  },
];

const CUSTOM_TEMPLATES_KEY = 'code-scrap-custom-templates';

export function loadCustomTemplates(): CodeSnippet[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CodeSnippet[];
    return Array.isArray(parsed)
      ? parsed.filter((s) => s.id && s.title && s.text && s.lang)
      : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: CodeSnippet): CodeSnippet[] {
  const next = [
    template,
    ...loadCustomTemplates().filter(
      (s) =>
        s.id !== template.id &&
        !(
          s.text === template.text &&
          s.note === template.note &&
          s.tag === template.tag
        ),
    ),
  ];
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时仍保留当前页面内的模板
  }
  return next;
}
