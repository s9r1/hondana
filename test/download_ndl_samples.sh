#!/bin/bash
# NDL SRU API からサンプルXMLをダウンロードする
# Usage: ./download_ndl_samples.sh [ISBN ...]
# 引数なしの場合はデフォルトのISBNリストを使用

set -euo pipefail

OUTDIR="$(dirname "$0")/ndl_samples"
mkdir -p "$OUTDIR"

DEFAULT_ISBNS=(
  9780195132601  # The Mechanisms of Governance
  9784641165779  # ゲーム理論 / 岡田章
)

ISBNS=("${@:-${DEFAULT_ISBNS[@]}}")

for isbn in "${ISBNS[@]}"; do
  url="https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&recordSchema=dcndl&maximumRecords=1&onlyBib=true&query=isbn=${isbn}"
  outfile="${OUTDIR}/${isbn}.xml"
  echo -n "Fetching ${isbn} ... "
  if curl -sf "$url" -o "$outfile"; then
    echo "OK -> ${outfile}"
  else
    echo "FAILED"
  fi
done

echo ""
echo "Done. Files saved to ${OUTDIR}/"
