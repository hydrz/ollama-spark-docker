#!/usr/bin/env bash
set -euo pipefail

CUDA_ARCH="75;80;86;89"
JOBS="8"
TAG="ollama-spark:latest"

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --arch <arch>    CUDA Architectures (default: \"75;80;86;89\")"
    echo "                       Examples: \"89\" (Ada/RTX40), \"86\" (Ampere/RTX30), \"80\" (A100)"
    echo "  -j, --jobs <n>       Parallel build jobs (default: 8)"
    echo "  -t, --tag <tag>      Docker image tag (default: \"ollama-spark:latest\")"
    echo "  -h, --help           Show this help message"
    echo ""
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -a|--arch)
            CUDA_ARCH="$2"
            shift 2
            ;;
        -j|--jobs)
            JOBS="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -h|--help)
            print_usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            print_usage
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== Building Ollama for Spark-X2.5 ==="
echo "CUDA Architectures : ${CUDA_ARCH}"
echo "Build Jobs         : ${JOBS}"
echo "Target Tag         : ${TAG}"
echo "Context Dir        : ${ROOT_DIR}"
echo "======================================"

export DOCKER_BUILDKIT=1

docker build \
    --file "${ROOT_DIR}/Dockerfile" \
    --tag "${TAG}" \
    --build-arg CUDA_ARCHITECTURES="${CUDA_ARCH}" \
    --build-arg BUILD_JOBS="${JOBS}" \
    "${ROOT_DIR}"

echo ""
echo "Build completed successfully! Image tagged as: ${TAG}"
echo "To start container, run: docker compose up -d"
