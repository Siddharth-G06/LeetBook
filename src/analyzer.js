export function detectPatterns(code, language) {
  const codeLower = code.toLowerCase();
  const patterns = [];

  if (/(left.*right|start.*end|i\s*=\s*0.*j\s*=\s*.*\.length|low.*high)/i.test(codeLower)) {
    patterns.push("Two Pointers");
  }
  
  if (/(window|left.*right|i.*j.*Math\.max|j\s*-\s*i|i\s*-\s*left)/i.test(codeLower) && /while|for/.test(codeLower)) {
    patterns.push("Sliding Window");
  }
  
  if (/(new\s+(map|set)|dict\(|\{\}|unordered_(map|set)|hashmap|hashset)/i.test(codeLower)) {
    patterns.push("Hash Map / Set");
  }
  
  if (/(dp\[|memo\[|cache|new\s+Array.*fill|vector.*dp|@cache|lru_cache)/i.test(codeLower)) {
    patterns.push("Dynamic Programming");
  }
  
  if (/(queue|deque|shift\(\)|pop\(0\)|q\.push|q\.empty\(\))/i.test(codeLower)) {
    patterns.push("BFS");
  }
  
  if (/(dfs|stack|pop\(\)|push\(\)|visited)/i.test(codeLower) && !patterns.includes("BFS")) {
    patterns.push("DFS");
  }
  
  if (/(mid\s*=\s*.*\(.*low.*\+.*high.*\)\s*\/\s*2|low\s*<=\s*high|left\s*<=\s*right)/i.test(codeLower) && !codeLower.includes("sort")) {
    patterns.push("Binary Search");
  }
  
  if (/(backtrack|path\.push|path\.pop|curr\.add|curr\.remove|ans\.push)/i.test(codeLower)) {
    patterns.push("Backtracking");
  }
  
  if (/(sort\(|Arrays\.sort|Collections\.sort|qsort)/i.test(codeLower) && !patterns.includes("Binary Search")) {
    patterns.push("Greedy / Sorting");
  }

  if (/(priorityqueue|heap|heapq|heappush|heappop|priority_queue)/i.test(codeLower)) {
    patterns.push("Heap / Priority Queue");
  }

  if (patterns.length === 0 && /(return\s+[a-zA-Z0-9_]+\(.*\)|\w+\(.*\).*return)/.test(codeLower)) {
    patterns.push("Recursion");
  }

  if (patterns.length === 0) {
    patterns.push("Implementation");
  }

  return [...new Set(patterns)];
}
