export interface CodeSnippet {
  id: string;
  text: string;
  lang: 'js' | 'py';
}

// 6~8 段短代码，像从杂志上剪下来的代码纸片
export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'c1',
    lang: 'js',
    text: `const sum = (a, b) => a + b;
console.log(sum(2, 3)); // 5`,
  },
  {
    id: 'c2',
    lang: 'js',
    text: `useEffect(() => {
  fetchData();
}, []);`,
  },
  {
    id: 'c3',
    lang: 'js',
    text: `function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}`,
  },
  {
    id: 'c4',
    lang: 'py',
    text: `def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)`,
  },
  {
    id: 'c5',
    lang: 'py',
    text: `nums = [1, 2, 3, 4]
squares = [x*x for x in nums]
print(squares)`,
  },
  {
    id: 'c6',
    lang: 'js',
    text: `const data = await res.json();
setItems(data);`,
  },
  {
    id: 'c7',
    lang: 'js',
    text: `return (
  <div className="card">
    {children}
  </div>
);`,
  },
  {
    id: 'c8',
    lang: 'py',
    text: `with open("log.txt", "a") as f:
    f.write("done\\n")`,
  },
];
