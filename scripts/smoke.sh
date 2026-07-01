#!/usr/bin/env bash
# Smoke tests for town-store-os API + pages.
#
# Usage:
#   BASE_URL=http://localhost:3000 ./scripts/smoke.sh
#
# 默认连本机 dev/prod server。CI workflow 里 build + start + 跑此脚本。
# 测试结果用 docs/testing.md 的用例编号对应，方便排查回归。

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS=0
FAIL=0
FAILED_TESTS=()

# ANSI 颜色
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
DIM=$'\033[0;2m'
RESET=$'\033[0m'

ok() { echo "${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
fail() { echo "${RED}✗${RESET} $1${DIM} — $2${RESET}"; FAIL=$((FAIL + 1)); FAILED_TESTS+=("$1"); }
section() { echo ""; echo "${YELLOW}=== $1 ===${RESET}"; }

# ---- helpers ----

# req <method> <url> [json_data]
# 把响应 body 写到 /tmp/_smoke_body，stdout 是 HTTP status code
req() {
  local method="$1"; shift
  local url="$1"; shift
  local data="${1:-}"
  local args=(-s -o /tmp/_smoke_body -w "%{http_code}" -X "$method")
  if [ -n "$data" ]; then
    args+=(-H "Content-Type: application/json" --data-binary "$data")
  fi
  args+=("$BASE_URL$url")
  curl "${args[@]}"
}

# get_status <expected> <method> <url> [data] <desc>
assert_status() {
  local expected="$1" method="$2" url="$3" data="$4" desc="$5"
  local actual
  actual=$(req "$method" "$url" "$data")
  if [ "$actual" = "$expected" ]; then
    ok "$desc"
  else
    fail "$desc" "expected=$expected got=$actual"
  fi
}

# ---- readiness ----

section "server readiness"
ready=0
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/products" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    ok "Server ready at $BASE_URL (took ${i}*2s)"
    ready=1
    break
  fi
  sleep 2
done
if [ $ready -eq 0 ]; then
  fail "Server readiness" "not ready after 60s (last code: $code)"
  echo "${RED}Smoke tests aborted${RESET}"
  exit 1
fi

# ---- Task 2 · Product API ----

section "Task 2 · Product API"

assert_status 200 GET "/api/products" "" "GET /api/products → 200"

# 搜索（按 barcode）
code=$(req GET "/api/products?q=6901234567001")
count=$(python3 -c "import json; print(len(json.load(open('/tmp/_smoke_body'))['products']))" 2>/dev/null || echo "0")
[ "$code" = "200" ] && [ "$count" -ge "1" ] \
  && ok "GET /api/products?q=6901234567001 → $count results" \
  || fail "GET search by barcode" "code=$code count=$count"

# 分类筛选
code=$(req GET "/api/products?category=%E9%A5%AE%E6%96%99")
count=$(python3 -c "import json; print(len(json.load(open('/tmp/_smoke_body'))['products']))" 2>/dev/null || echo "0")
[ "$code" = "200" ] && [ "$count" -ge "1" ] \
  && ok "GET /api/products?category=饮料 → $count results" \
  || fail "GET filter by category" "code=$code count=$count"

# 创建合法商品（测试结束时会删）
SMOKE_BODY='{"name":"烟测专用商品","category":"测试","barcode":"SMOKE-TEST-001","costPrice":1,"salePrice":2,"stock":5}'
code=$(req POST "/api/products" "$SMOKE_BODY")
SMOKE_ID=$(python3 -c "import json; print(json.load(open('/tmp/_smoke_body'))['product']['id'])" 2>/dev/null || echo "")
[ "$code" = "201" ] && [ -n "$SMOKE_ID" ] \
  && ok "POST /api/products (valid) → 201, id=$SMOKE_ID" \
  || fail "POST create valid" "code=$code"

assert_status 422 POST "/api/products" '{"name":"","category":"x","costPrice":1,"salePrice":2}' "POST invalid (empty name) → 422"
assert_status 409 POST "/api/products" '{"name":"重复","category":"x","barcode":"SMOKE-TEST-001","costPrice":1,"salePrice":2}' "POST duplicate barcode → 409"
assert_status 422 POST "/api/products" '{"name":"价","category":"x","costPrice":5,"salePrice":3}' "POST salePrice < costPrice → 422"

if [ -n "$SMOKE_ID" ]; then
  assert_status 200 GET "/api/products/$SMOKE_ID" "" "GET /api/products/[id] → 200"
  assert_status 404 GET "/api/products/nonexistent_id_xxx" "" "GET /api/products/missing → 404"
  assert_status 200 PATCH "/api/products/$SMOKE_ID" '{"salePrice":2.5}' "PATCH price → 200"
  assert_status 200 PATCH "/api/products/$SMOKE_ID" '{"stock":3}' "PATCH stock 5→3 → 200 (writes ADJUSTMENT)"
  assert_status 422 PATCH "/api/products/$SMOKE_ID" '{"salePrice":0.5}' "PATCH salePrice<costPrice (merged check) → 422"
fi

# ---- Task 5 · Sale API ----

section "Task 5 · Sale API"

# 取一个已有商品做销售（用 seed 里的可口可乐）
PRODUCT_ID=$(curl -s "$BASE_URL/api/products?q=6901234567001" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['products'][0]['id'])" 2>/dev/null || echo "")
[ -n "$PRODUCT_ID" ] && ok "Found seed product: $PRODUCT_ID" || fail "Find seed product" "empty"

if [ -n "$PRODUCT_ID" ]; then
  before=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])" 2>/dev/null || echo "0")

  assert_status 201 POST "/api/sales" "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}]}" "POST /api/sales → 201"

  after=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])" 2>/dev/null || echo "0")
  expected=$((before - 1))
  [ "$after" = "$expected" ] && ok "Stock decremented $before → $after" || fail "Stock decrement" "got $after expected $expected"
fi

if [ -n "$SMOKE_ID" ]; then
  assert_status 422 POST "/api/sales" "{\"items\":[{\"productId\":\"$SMOKE_ID\",\"quantity\":999}]}" "POST sale insufficient stock → 422"
fi

assert_status 422 POST "/api/sales" '{"items":[{"productId":"nonexistent","quantity":1}]}' "POST sale non-existent product → 422"
assert_status 422 POST "/api/sales" '{"items":[]}' "POST sale empty items → 422"
if [ -n "$PRODUCT_ID" ]; then
  assert_status 422 POST "/api/sales" "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":-1}]}" "POST sale negative qty → 422"
fi

# 原子性：有效+无效组合 → 全部回滚
if [ -n "$SMOKE_ID" ] && [ -n "$PRODUCT_ID" ]; then
  before_smoke=$(curl -s "$BASE_URL/api/products/$SMOKE_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])")
  before_seed=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])")
  sales_before=$(curl -s "$BASE_URL/api/sales" \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin)['sales']))")

  code=$(req POST "/api/sales" "{\"items\":[{\"productId\":\"$SMOKE_ID\",\"quantity\":1},{\"productId\":\"$PRODUCT_ID\",\"quantity\":9999}]}")

  after_smoke=$(curl -s "$BASE_URL/api/products/$SMOKE_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])")
  after_seed=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['product']['stock'])")
  sales_after=$(curl -s "$BASE_URL/api/sales" \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin)['sales']))")

  if [ "$code" = "422" ] \
    && [ "$before_smoke" = "$after_smoke" ] \
    && [ "$before_seed" = "$after_seed" ] \
    && [ "$sales_before" = "$sales_after" ]; then
    ok "Atomic rollback on partial failure"
  else
    fail "Atomic rollback" "code=$code smoke=$before_smoke→$after_smoke seed=$before_seed→$after_seed sales=$sales_before→$sales_after"
  fi
fi

assert_status 200 GET "/api/sales" "" "GET /api/sales → 200"

# ---- Pages ----

section "Pages"

for path in /products /products/new /sales /sales/new /dashboard; do
  assert_status 200 GET "$path" "" "GET $path → 200"
done

if [ -n "$PRODUCT_ID" ]; then
  assert_status 200 GET "/products/$PRODUCT_ID/edit" "" "GET /products/[id]/edit → 200"
fi

# 首页重定向
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
[ "$code" = "307" ] && ok "GET / → 307 (redirect)" || fail "GET / redirect" "got $code"

# ---- 清理 ----

if [ -n "$SMOKE_ID" ]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/products/$SMOKE_ID")
  [ "$code" = "204" ] && ok "Cleanup: DELETE smoke product → 204" || fail "Cleanup" "got $code"
fi

# ---- 总结 ----

echo ""
echo "${YELLOW}=== Summary ===${RESET}"
echo "  Passed: ${GREEN}$PASS${RESET}"
echo "  Failed: ${RED}$FAIL${RESET}"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "${RED}Failed tests:${RESET}"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi
echo "${GREEN}All smoke tests passed ✓${RESET}"