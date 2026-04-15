#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-"$ROOT_DIR/public/media/home"}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg is required but not installed." >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Error: target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

echo "Converting MP4 files under: $TARGET_DIR"

shopt -s globstar nullglob
MP4_FILES=("$TARGET_DIR"/**/*.mp4)

if [[ ${#MP4_FILES[@]} -eq 0 ]]; then
  echo "No .mp4 files found."
  exit 0
fi

converted=0
skipped=0

for mp4_path in "${MP4_FILES[@]}"; do
  webm_path="${mp4_path%.mp4}.webm"

  if [[ -f "$webm_path" ]]; then
    echo "Skipping existing: $webm_path"
    skipped=$((skipped + 1))
    continue
  fi

  echo "Converting: $mp4_path -> $webm_path"
  ffmpeg -hide_banner -loglevel error -y \
    -i "$mp4_path" \
    -c:v libvpx-vp9 -pix_fmt yuv420p -crf 33 -b:v 0 -row-mt 1 -threads 8 -g 240 \
    -c:a libopus -b:a 96k \
    "$webm_path"

  converted=$((converted + 1))
done

echo "Done. Converted: $converted, skipped: $skipped"
