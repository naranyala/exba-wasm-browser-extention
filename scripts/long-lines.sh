#!/bin/bash
# Find the longest line per source file (no duplicates per file)
# Usage: bun run longlines [threshold] [top_n]
#   threshold - minimum line length to report (default: 120)
#   top_n     - number of results to show (default: 10)

THRESHOLD="${1:-120}"
TOP_N="${2:-10}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

find "$ROOT_DIR" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.rs" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/.git/*" \
  ! -path "*/.chrome-profile/*" \
  ! -path "*/wasm/target/*" \
  ! -path "*/wasm/pkg/*" \
  -print0 | xargs -0 awk -v threshold="$THRESHOLD" '
    length > max[FILENAME] { max[FILENAME] = length; line[FILENAME] = NR; file[FILENAME] = FILENAME }
    END {
      for (f in max) {
        if (max[f] >= threshold) {
          printf "%d\t%s:%d\n", max[f], file[f], line[f]
        }
      }
    }
  ' | sort -rn | head -n "$TOP_N"
