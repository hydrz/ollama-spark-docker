# syntax=docker/dockerfile:1.7

ARG CUDA_VERSION=12.8.1

FROM ollama/ollama@sha256:020e4134285e2ef4d8fd801234176de3b4faadc992a3eb06c8e66a2f9d4c4ba2 AS upstream-runtime

FROM nvidia/cuda:${CUDA_VERSION}-devel-ubuntu24.04 AS builder

ARG OLLAMA_REF=86f72929348d384336b6f0adc129e71b2122abdc
ARG SPARK_LLAMA_CPP_REF=4a3635c32fc9f044c2bde9ebeabf50c7e1ec5991
ARG CUDA_ARCHITECTURES="75;80;86;89"
ARG BUILD_JOBS=8
ARG OLLAMA_VERSION=0.33.2-spark

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        curl \
        git \
        ninja-build \
    && rm -rf /var/lib/apt/lists/*

RUN git init /src/ollama \
    && git -C /src/ollama remote add origin https://github.com/ollama/ollama.git \
    && git -C /src/ollama fetch --depth 1 origin "${OLLAMA_REF}" \
    && git -C /src/ollama checkout --detach FETCH_HEAD \
    && git init /src/llama.cpp-spark \
    && git -C /src/llama.cpp-spark remote add origin https://github.com/XHToken/llama.cpp.git \
    && git -C /src/llama.cpp-spark fetch --depth 1 origin "${SPARK_LLAMA_CPP_REF}" \
    && git -C /src/llama.cpp-spark checkout --detach FETCH_HEAD

RUN GO_VERSION="$(awk '/^go / { print $2; exit }' /src/ollama/go.mod)" \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
      | tar -xz -C /usr/local

ENV PATH=/usr/local/go/bin:${PATH}
ENV OLLAMA_LLAMA_CPP_SOURCE=/src/llama.cpp-spark

WORKDIR /src/ollama

RUN --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/.cache/go-mod \
    --mount=type=cache,target=/root/.ccache \
    cmake -S . -B build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_CUDA_ARCHITECTURES="${CUDA_ARCHITECTURES}" \
      -DOLLAMA_BUILD_PARALLEL="${BUILD_JOBS}" \
      -DOLLAMA_LLAMA_BACKENDS=cuda_v12 \
      -DOLLAMA_VERSION="${OLLAMA_VERSION}" \
    && cmake --build build --parallel "${BUILD_JOBS}" \
    && cmake --install build --prefix /opt/ollama

FROM ubuntu:24.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/ollama/bin/ollama /usr/bin/ollama
COPY --from=builder /opt/ollama/lib/ollama /usr/lib/ollama
COPY --from=upstream-runtime /usr/lib/ollama/mlx_cuda_v13/libnccl.so.2.31.2 /usr/lib/ollama/cuda_v12/libnccl.so.2

ENV LD_LIBRARY_PATH=/usr/lib/ollama:/usr/lib/ollama/cuda_v12:/usr/local/nvidia/lib:/usr/local/nvidia/lib64
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
ENV NVIDIA_VISIBLE_DEVICES=all
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODELS=/root/.ollama/models

EXPOSE 11434

ENTRYPOINT ["/usr/bin/ollama"]
CMD ["serve"]
