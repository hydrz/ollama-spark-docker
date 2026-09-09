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

## 本机实测对比

使用评测脚本 [`scripts/benchmark-models.mjs`](scripts/benchmark-models.mjs) 进行同机对比测试：

| 项目 | Spark-X2.5-4B Q8 | Qwen3.5-9B Q6_K_XL |
| :--- | :--- | :--- |
| **模型大小** | 4.4GB | 9.7GB |
| **稳定输出速度** | 约 83–92 tok/s | 约 58–62 tok/s |
| **简单数学（关闭思考）** | 算错：6991 | 正确：7011 |
| **JSON 指令** | 正确 | 正确 |
| **不可哈希对象去重代码** | 未满足要求 | 正确 |
| **工具调用** | 成功生成调用 | 本次返回空，疑似模板兼容问题 |
| **综合特点** | 快、小、工具调用较好 | 推理和代码更可靠 |

### 运行评测脚本
```bash
node scripts/benchmark-models.mjs http://localhost:11434 spark-x2.5
```

## GitHub Actions 自动构建

流水线配置文件见 `.github/workflows/docker-publish.yml`：
- 推送到 `main` 分支或推送 Tag（如 `v*`）时，自动构建并发布至 `ghcr.io/<你的用户名>/ollama-spark-docker`。
- 支持在 GitHub 页面手动触发（`workflow_dispatch`），可按需指定 `cuda_architectures`。

## 常用 CUDA 架构代码

| 架构代号 | 常见显卡型号 |
| :--- | :--- |
| `89` | RTX 4090 / 4080 / 4070, L4, L40 |
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
