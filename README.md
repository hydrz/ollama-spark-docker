# Ollama Spark-X2.5 Docker 自动化构建与运行套件

[![Build and Publish Docker Image](https://github.com/your-username/ollama-spark-docker/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/your-username/ollama-spark-docker/actions/workflows/docker-publish.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

本项目基于科大讯飞定制的 [XHToken/llama.cpp](https://github.com/XHToken/llama.cpp) 构建兼容 **Spark-X2.5**（1.7B / 4B）的专属 Ollama 容器镜像。

官方原版 Ollama 尚未合并对 Spark-X2.5 混合注意力架构（Hybrid Attention）的支持。本项目提供**全自动 CI/CD 构建**、**参数化多架构支持**、**本地一键构建脚本**以及**开箱即用的 GPU 容器编排**。

---

## 🌟 特性亮点

- ⚡ **Spark-X2.5 深度兼容**：基于 XHToken 优化的 `llama.cpp` 编译内核，无缝支持 Spark-X2.5 GGUF 模型。
- 🔄 **GitHub Actions 自动构建**：支持代码 Push、Tag 发布自动构建并推送到 GitHub Container Registry (`ghcr.io`)，支持 Buildx 跨阶段缓存加速。
- 🚀 **参数化 CUDA 架构**：默认适配常用主流显卡架构（Turing / Ampere / Ada），支持单架构按需指定以实现秒级编译。
- 🐳 **开箱即用 Compose**：已配置好 NVIDIA Container Toolkit 直通、数据卷持久化与外部模型热挂载。
- 🛡️ **生产级运行时**：多阶段构建，补齐 `libgomp1`、`curl` 与 `libnccl` 关键依赖，内置容器心跳健康检查。

---

## 🖥️ GPU 架构代码参考 (CUDA_ARCHITECTURES)

构建时可根据您的 GPU 型号灵活配置 `CUDA_ARCHITECTURES`：

| 架构代号 | 对应显卡型号示例 | 说明 |
| :--- | :--- | :--- |
| `89` | RTX 4090, RTX 4080, RTX 4070, L4, L40 | Ada Lovelace 架构 |
| `86` | RTX 3090, RTX 3080, A2, A10, A40 | Ampere 消费级 / 工作站 |
| `80` | A100, A800 | Ampere 数据中心卡 |
| `75` | RTX 2080, RTX 2070, GTX 1660, T4 | Turing 架构 |
| `90` | H100, H800, H200 | Hopper 架构 |

*默认构建参数为 `"75;80;86;89"`，兼顾大部分主流显卡。如果仅在单机（如 RTX 4090）上运行，建议传入 `89` 获得最快构建速度。*

---

## 🚀 方式一：使用 GitHub Actions 自动构建 (推荐)

仓库已内置 `.github/workflows/docker-publish.yml` 工作流。

### 1. 自动触发
- **推送代码到 `main` 分支**：自动构建并更新 `ghcr.io/<你的用户名>/<仓库名>:latest` 镜像。
- **推送版本 Tag（如 `v0.33.2-spark`）**：自动构建并发布对应语义化标签的镜像。

### 2. 手动在网页端触发构建
进入 GitHub 仓库页面：
1. 点击 **Actions** 选项卡。
2. 在左侧选择 **Build and Publish Docker Image**。
3. 点击 **Run workflow**：
   - 可输入自定义 `cuda_architectures`（如填 `89` 加速 Ada 显卡构建）。
   - 选择是否自动推送至 `ghcr.io`。

### 3. 拉取并运行已发布的镜像
```bash
# 登录 GHCR（私有仓库需要）
echo $CR_PAT | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin

# 拉取镜像
docker pull ghcr.io/<YOUR_GITHUB_USERNAME>/<REPOSITORY_NAME>:latest
```

---

## 🛠️ 方式二：本地一键构建

### 前置要求
- 已安装 Docker 24.0+，并启用 BuildKit。
- 宿主机已安装 NVIDIA 驱动及 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)。

### 1. 使用一键脚本构建

**Linux / macOS / WSL：**
```bash
# 赋予执行权限
chmod +x scripts/build.sh

# 默认构建（包含 75;80;86;89 架构，8 并发）
./scripts/build.sh

# 针对单显卡快速构建（例如 RTX 4090 填 89，16 并发）
./scripts/build.sh -a "89" -j 16 -t "ollama-spark:latest"
```

**Windows (PowerShell)：**
```powershell
# 默认构建
.\scripts\build.ps1

# 单架构快速构建
.\scripts\build.ps1 -Arch "89" -Jobs 16 -Tag "ollama-spark:latest"
```

### 2. 使用 Docker Compose 直接构建并启动
```bash
# 构建并启动
docker compose up -d --build

# 查看运行日志
docker compose logs -f
```

---

## 📦 Spark-X2.5 模型导入与运行

### 步骤 1：获取 Spark-X2.5 GGUF 权重
从 [ModelScope](https://www.modelscope.cn/) 或 [Hugging Face](https://huggingface.co/) 下载适配好的 Spark-X2.5 GGUF 文件：

将文件放置在宿主机的 `./models/` 目录下，例如：
```text
models/spark-x2.5-4b.gguf
```

### 步骤 2：启动 Ollama 容器
确保容器处于运行状态：
```bash
docker compose up -d
```

### 步骤 3：根据 Modelfile 创建模型
进入容器执行导入：
```bash
docker compose exec ollama-spark ollama create spark-x2.5 -f /modelfiles/Modelfile.spark-x2.5
```

### 步骤 4：运行与测试对话
```bash
# 终端交互式对话
docker compose exec -it ollama-spark ollama run spark-x2.5
```

---

## 🔌 API 调用示例

Ollama 原生兼容 OpenAI 格式 API 与 Ollama 原生 API，外部端口为 `11434`。

### 1. cURL 测试
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "spark-x2.5",
  "prompt": "你好，请介绍一下你自己。",
  "stream": false
}'
```

### 2. OpenAI SDK 调用 (Python)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama", # 任意填写
)

response = client.chat.completions.create(
    model="spark-x2.5",
    messages=[
        {"role": "user", "content": "请用三句话总结量子计算的核心优势。"}
    ]
)

print(response.choices[0].message.content)
```

---

## ⚙️ Dockerfile 构建参数说明

构建时支持通过 `--build-arg` 定制以下参数：

| 参数名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `CUDA_VERSION` | `12.8.1` | 基础编译镜像使用的 CUDA 版本 |
| `OLLAMA_REF` | `86f7292...` | Ollama 基础仓库的 Git Commit / Tag |
| `SPARK_LLAMA_CPP_REF` | `4a3635c...` | XHToken/llama.cpp 的 Git Commit / Tag |
| `CUDA_ARCHITECTURES` | `75;80;86;89` | CMake 编译的 CUDA 目标架构列表 |
| `BUILD_JOBS` | `8` | 并发编译线程数 |
| `OLLAMA_VERSION` | `0.33.2-spark` | 标识版本号 |

---

## ❓ 常见问题排查 (Troubleshooting)

1. **容器无法识别 GPU (`could not select device driver "" with capabilities: [[gpu]]`)**
   - 确保宿主机已安装 `nvidia-container-toolkit` 并配置了 Docker 守护进程：
     ```bash
     sudo nvidia-ctk runtime configure --runtime=docker
     sudo systemctl restart docker
     ```

2. **编译卡住或内存溢出 (OOM)**
   - 同时编译多个 CUDA 架构极度消耗内存。若宿主机内存较小，请调小 `BUILD_JOBS`（如 `-j 4`）或指定单一架构（如 `-a 89`）。

3. **模型显存不足**
   - Spark-X2.5 在较长上下文时会占用更多 KV Cache。可通过在 Modelfile 中增加 `PARAMETER num_ctx 4096` 来限制初始上下文窗口。
