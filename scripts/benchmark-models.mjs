const endpoint = process.argv[2];
const model = process.argv[3];

if (!endpoint || !model) {
  console.error("Usage: node benchmark-models.mjs <endpoint> <model>");
  console.error("Example: node benchmark-models.mjs http://localhost:11434 spark-x2.5");
  process.exit(2);
}

const cases = [
  {
    name: "arithmetic",
    prompt: "只回答数字：123乘以57等于多少？",
    numPredict: 64,
  },
  {
    name: "instruction_json",
    prompt:
      '只输出一行合法JSON，不要Markdown，不要解释。字段固定为name、sum、items；name值为“测试”；sum值为17与25之和；items值为按原顺序排列的字符串数组["甲","乙","甲"]。',
    numPredict: 128,
  },
  {
    name: "coding",
    prompt:
      "只输出完整Python函数，不要解释，不要Markdown。修复：def stable_unique(items): return list(set(items))。要求保持首次出现顺序、支持列表和字典等不可哈希元素、不修改输入。",
    numPredict: 512,
  },
];

async function request(path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return JSON.parse(text);
}

for (const test of cases) {
  const result = await request("/api/generate", {
    model,
    prompt: test.prompt,
    stream: false,
    think: false,
    keep_alive: "10m",
    options: {
      num_ctx: 8192,
      num_predict: test.numPredict,
      temperature: 0,
    },
  });

  console.log(
    JSON.stringify({
      model,
      test: test.name,
      response: result.response,
      done_reason: result.done_reason,
      prompt_tokens: result.prompt_eval_count,
      output_tokens: result.eval_count,
      prompt_tps:
        result.prompt_eval_duration > 0
          ? (result.prompt_eval_count * 1e9) / result.prompt_eval_duration
          : null,
      output_tps:
        result.eval_duration > 0
          ? (result.eval_count * 1e9) / result.eval_duration
          : null,
      load_seconds: result.load_duration / 1e9,
    }),
  );
}

const toolResult = await request("/api/chat", {
  model,
  messages: [
    {
      role: "user",
      content: "北京现在天气怎么样？不要猜测，必须调用提供的工具。",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "查询指定城市当前天气",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    },
  ],
  stream: false,
  think: false,
  keep_alive: "10m",
  options: { num_ctx: 8192, num_predict: 256, temperature: 0 },
});

console.log(
  JSON.stringify({
    model,
    test: "tool_call",
    content: toolResult.message?.content,
    tool_calls: toolResult.message?.tool_calls,
    done_reason: toolResult.done_reason,
    output_tokens: toolResult.eval_count,
    output_tps:
      toolResult.eval_duration > 0
        ? (toolResult.eval_count * 1e9) / toolResult.eval_duration
        : null,
  }),
);
