const endpointSpark = process.argv[2] || "http://llm-ollama-spark:11434";
const endpointOfficial = process.argv[3] || "http://llm-ollama:11434";

const modelSpark = "modelscope.cn/XHToken/Spark-X2.5-4B-GGUF:Q8_0";
const modelQwen = "modelscope.cn/unsloth/Qwen3.5-9B-GGUF:UD-Q6_K_XL";

console.log("=== 全面多维度模型对比测试 ===");
console.log(`Spark-X2.5 Endpoint : ${endpointSpark} | Model: ${modelSpark}`);
console.log(`Qwen3.5-9B  Endpoint : ${endpointOfficial} | Model: ${modelQwen}`);
console.log("===============================\n");

async function request(endpoint, path, body) {
  const t0 = Date.now();
  const response = await fetch(`${endpoint}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const totalDurationMs = Date.now() - t0;
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  const data = JSON.parse(text);
  data._totalDurationMs = totalDurationMs;
  return data;
}

// 长文本测试材料
const fillerText = "在分布式系统架构中，一致性哈希与分布式事务处理是关键议题。为了保证微服务间高可用，通常引入raft或paxos协议作为基础共识算法。系统的性能调优往往需要在延迟、吞吐量和资源利用率之间寻求平衡。在日常观测中，Prometheus与Grafana构成了核心监控栈，帮助工程师及时定位瓶颈。".repeat(20);
const secretHaystack = `${fillerText}\n重要备忘录：关于下季度的重点代号为【SECRET_PASSCODE_SPARK_7788】，请各团队保密。\n${fillerText}`;

const testSuites = [
  {
    id: "math_cot",
    category: "数学推理 (CoT)",
    prompt: "请一步步计算：456乘以78加上1234等于多少？最后一行单独输出结果：'ANSWER: <数字>'。",
    numPredict: 512,
  },
  {
    id: "logic_puzzle",
    category: "复杂逻辑推理",
    prompt: "甲、乙、丙三人中，一个是教师，一个是医生，一个是律师。甲说：'我不是医生'。乙说：'我是教师'。已知三人中只有一人说了真话。请问：甲、乙、丙分别是什么职业？请简要推理并给出最终结论。",
    numPredict: 512,
  },
  {
    id: "negative_constraint",
    category: "严格指令遵循与负向约束",
    prompt: "请写一段介绍'人工智能发展'的短文，严格遵守以下三条规则：\n1. 恰好输出3个要点；\n2. 全文中严禁出现汉字'能'和汉字'算'；\n3. 不要任何前言和结语，直接输出这3点。",
    numPredict: 256,
  },
  {
    id: "coding_unhashable",
    category: "编程：不可哈希对象去重",
    prompt: "写一个Python函数 def stable_unique(items)，要求：1. 保持元素首次出现的相对顺序；2. 能够正确处理包含不可哈希对象（如dict、list）的集合且不抛异常；3. 不要解释，只输出代码。",
    numPredict: 512,
  },
  {
    id: "coding_algo",
    category: "编程：算法实现 (LRU Cache)",
    prompt: "用Python实现一个基础的LRUCache类，包含get(key)和put(key, value)，容量上限为capacity，get和put操作要求平均时间复杂度O(1)。不要解释，只输出代码。",
    numPredict: 512,
  },
  {
    id: "needle_haystack",
    category: "长文本关键信息检索",
    prompt: `阅读以下资料并回答：\n${secretHaystack}\n\n问题：上文中提到的重点代号是什么？只需输出该代号。`,
    numPredict: 128,
  }
];

const toolSuite = {
  id: "tool_selection",
  category: "工具调用与选型 (Tool Calling)",
  messages: [
    { role: "user", content: "请帮我查一下杭州现在的实时天气，然后再帮我计算 358 乘以 24。" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "获取指定城市的实时天气",
        parameters: {
          type: "object",
          properties: { city: { type: "string", description: "城市名称" } },
          required: ["city"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "calculate",
        description: "执行数学表达式计算",
        parameters: {
          type: "object",
          properties: { expression: { type: "string", description: "数学算式" } },
          required: ["expression"]
        }
      }
    }
  ]
};

async function runModelTests(endpoint, model, label) {
  console.log(`\n================== 开始测试：${label} ==================`);
  const results = [];

  for (const test of testSuites) {
    process.stdout.write(`正在运行 [${test.category}] ... `);
    try {
      const res = await request(endpoint, "/api/generate", {
        model,
        prompt: test.prompt,
        stream: false,
        think: false,
        keep_alive: "10m",
        options: {
          num_ctx: 8192,
          num_predict: test.numPredict,
          temperature: 0,
        }
      });

      const outTps = res.eval_duration > 0 ? (res.eval_count * 1e9) / res.eval_duration : 0;
      const promptTps = res.prompt_eval_duration > 0 ? (res.prompt_eval_count * 1e9) / res.prompt_eval_duration : 0;
      console.log(`完成! (输出: ${outTps.toFixed(1)} tok/s, 耗时: ${(res._totalDurationMs/1000).toFixed(2)}s)`);

      results.push({
        id: test.id,
        category: test.category,
        response: res.response.trim(),
        outTps,
        promptTps,
        outputTokens: res.eval_count,
        promptTokens: res.prompt_eval_count,
      });
    } catch (err) {
      console.log(`失败: ${err.message}`);
      results.push({ id: test.id, category: test.category, error: err.message });
    }
  }

  // 工具调用测试
  process.stdout.write(`正在运行 [${toolSuite.category}] ... `);
  try {
    const res = await request(endpoint, "/api/chat", {
      model,
      messages: toolSuite.messages,
      tools: toolSuite.tools,
      stream: false,
      think: false,
      keep_alive: "10m",
      options: { num_ctx: 8192, num_predict: 256, temperature: 0 }
    });
    const outTps = res.eval_duration > 0 ? (res.eval_count * 1e9) / res.eval_duration : 0;
    console.log(`完成!`);
    results.push({
      id: toolSuite.id,
      category: toolSuite.category,
      content: res.message?.content || "",
      toolCalls: res.message?.tool_calls || [],
      outTps,
      outputTokens: res.eval_count,
    });
  } catch (err) {
    console.log(`失败: ${err.message}`);
    results.push({ id: toolSuite.id, category: toolSuite.category, error: err.message });
  }

  return results;
}

async function main() {
  const sparkRes = await runModelTests(endpointSpark, modelSpark, "Spark-X2.5-4B Q8");
  const qwenRes = await runModelTests(endpointOfficial, modelQwen, "Qwen3.5-9B Q6_K_XL");

  console.log("\n\n=================== 完整对比结果汇总 (JSON) ===================");
  console.log(JSON.stringify({ spark: sparkRes, qwen: qwenRes }, null, 2));
}

main().catch(err => {
  console.error("执行出错:", err);
  process.exit(1);
});
