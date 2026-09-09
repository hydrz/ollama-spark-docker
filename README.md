# ollama-spark-docker

用于运行 Spark-X2.5（1.7B / 4B）的 Ollama Docker 镜像构建工程。由于官方 Ollama 尚未合入对 `Spark2_5ForCausalLM` 架构的支持，本项目通过集成 [XHToken/llama.cpp](https://github.com/XHToken/llama.cpp) 定制构建。

支持 GitHub Actions 自动构建推送到 GHCR，以及本地使用 Docker Compose 或脚本构建运行。

## 模型下载

Spark-X2.5 的 GGUF 权重可在以下官方地址获取：
- Hugging Face: [XHToken/spark-x25](https://huggingface.co/collections/XHToken/spark-x25)
- ModelScope: [XHToken/Spark-X25](https://www.modelscope.cn/collections/XHToken/Spark-X25)

下载后将 `.gguf` 文件放入 `./models/` 目录（例如 `./models/spark-x2.5-4b.gguf`）。

## 快速开始

### 1. 构建与启动

**使用 Docker Compose（推荐）：**
```bash
docker compose up -d --build
```

**使用构建脚本（可指定单一架构以加速编译）：**
- Linux / WSL:
  ```bash
  chmod +x scripts/build.sh
  ./scripts/build.sh -a "89" -j 8  # 89 对应 RTX 40 系，默认 "75;80;86;89"
  ```
- Windows:
  ```powershell
  .\scripts\build.ps1 -Arch "89" -Jobs 8
  ```

### 2. 导入与运行模型

```bash
# 启动容器
docker compose up -d

# 导入模型
docker compose exec ollama-spark ollama create spark-x2.5 -f /modelfiles/Modelfile.spark-x2.5

# 命令行测试运行
docker compose exec -it ollama-spark ollama run spark-x2.5
```

### 3. API 测试

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "spark-x2.5",
  "prompt": "你好",
  "stream": false
}'
```

## 本机实测对比（RTX 4070 Ti Super 16G）

### 1. 基础场景对比

测试脚本：[`scripts/benchmark-models.mjs`](scripts/benchmark-models.mjs)

| 项目 | Spark-X2.5-4B Q8 | Qwen3.5-9B Q6_K_XL |
| :--- | :--- | :--- |
| **模型大小** | 4.4GB | 9.7GB |
| **稳定输出速度** | 约 83–92 tok/s | 约 58–62 tok/s |
| **简单数学（关闭思考）** | 算错：6991 | 正确：7011 |
| **JSON 指令** | 正确 | 正确 |
| **不可哈希对象去重代码** | 未满足要求（报 TypeError） | 正确 |
| **工具调用** | 成功生成调用 | 返回空（模板兼容问题） |
| **综合特点** | 快、小、工具调用原生顺畅 | 推理与代码边界更扎实 |

### 2. 进阶多维度测试

测试脚本：[`scripts/comprehensive-benchmark.mjs`](scripts/comprehensive-benchmark.mjs)

| 测试维度 | 测试内容 | Spark-X2.5-4B Q8 | Qwen3.5-9B Q6_K_XL | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **步骤数学推理 (CoT)** | 456*78+1234 拆解计算 | 正确 (36802)<br>耗时 4.1s (92 tok/s) | 正确 (36802)<br>耗时 14.4s (66 tok/s) | 允许思考步骤时，Spark-X2.5 计算恢复正确且耗时明显更短 |
| **元逻辑反思** | 题干存在未发陈述角色的逻辑题 | 直接套用套路推导 | 敏锐质疑题干信息缺失并展开深层分析 | 9B 模型对题目隐式逻辑漏洞审视更深刻 |
| **严格负向约束** | 介绍AI，**严禁出现汉字“能”和“算”** | **完全遵守**（零违禁词） | ❌ 违背（出现“算力”、“算法”、“赋能”） | Spark-X2.5 对硬性负向约束的遵循极其严格 |
| **复杂算法实现** | 手写 O(1) 的 LRUCache | **正确**（双向链表+哈希表） | **正确**（双向链表+哈希表） | 常见算法结构两者均能零差错实现 |
| **长文本检索 (Needle)** | ~3000 Token 文本中抽取密匙 | **100% 命中**<br>Prefill 吞吐: **9200 tok/s** | **100% 命中**<br>Prefill 吞吐: 4901 tok/s | 混合注意力架构使 Spark 长文本预填充吞吐接近 9B 的两倍 |
| **多工具并行调用** | 同时查询天气并执行复杂计算 | **成功并行生成两个 tool_calls** | 未生成调用（返回空） | Spark-X2.5 具备优秀的 Function Calling 与 Agent 适应能力 |

### 3. 适用场景建议

两者没有绝对的“全面超越”，而是互补型定位：

- **适合选用 Spark-X2.5-4B 的场景：**
  - **AI Agent 调度中枢**：依赖 Function Calling 调用外部 API、多工具并行触发。
  - **RAG / 长文档检索问答**：9200+ tok/s 的 Prefill 吞吐带来极低的首字延迟（TTFT）。
  - **显存受限或高吞吐服务**：显存仅需 4.4GB，生成速度 90+ tok/s，适合并发服务或端侧部署。
  - **强规则约束输出**：对格式、结构化输出、负向词语过滤有硬性要求的任务。

- **适合选用 Qwen3.5-9B 的场景：**
  - **深度代码生成与排错**：处理复杂语法边缘条件（如不可哈希元素、复杂并发逻辑）。
  - **数理与逻辑推演**：需要模型自我反思、审视边界与漏洞的高难度逻辑任务。

### 4. 运行本地评测脚本

```bash
# 基础测试
node scripts/benchmark-models.mjs http://localhost:11434 spark-x2.5

# 全维度综合对比测试 (需同时启动两个模型端点)
node scripts/comprehensive-benchmark.mjs http://<spark_ip>:11434 http://<qwen_ip>:11434
```

## GitHub Actions 自动构建

流水线配置文件见 `.github/workflows/docker-publish.yml`：
- 推送到 `main` 分支或推送 Tag（如 `v*`）时，自动构建并发布至 `ghcr.io/<你的用户名>/ollama-spark-docker`。
- 支持在 GitHub 页面手动触发（`workflow_dispatch`），可按需指定 `cuda_architectures`。

## 常用 CUDA 架构代码

| 架构代号 | 常见显卡型号 |
| :--- | :--- |
| `89` | RTX 4090 / 4080 / 4070 / 4070TiSuper, L4, L40 |
| `86` | RTX 3090 / 3080 / 3070, A10 |
| `80` | A100 / A800 |
| `75` | RTX 2080 / 2070, T4 |

## 构建参数 (ARG)

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `CUDA_ARCHITECTURES` | `75;80;86;89` | 编译的 CUDA 目标架构 |
| `BUILD_JOBS` | `8` | 编译并发数 |
| `CUDA_VERSION` | `12.8.1` | CUDA 开发镜像版本 |
| `OLLAMA_REF` | `86f7292...` | Ollama 基础 commit |
| `SPARK_LLAMA_CPP_REF` | `4a3635c...` | XHToken/llama.cpp commit |
