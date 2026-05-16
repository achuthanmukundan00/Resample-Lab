#!/usr/bin/env bash
# Resample-Lab smoke test — end-to-end pack generation
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
TEST_DIR="${TEST_DIR:-$(mktemp -d)}"

echo "═══ Resample-Lab Smoke Test ═══"
echo "  API:   ${API_URL}"
echo "  Temp:  ${TEST_DIR}"
echo ""

# 1. Generate test audio with ffmpeg
echo "--- Step 1: Generate test audio ---"
ffmpeg -y -f lavfi -i "sine=frequency=220:duration=3" -ar 44100 -ac 1 "${TEST_DIR}/test.wav" 2>/dev/null

if [ ! -f "${TEST_DIR}/test.wav" ]; then
    echo "FAIL: test audio not generated"
    exit 1
fi
echo "  Created ${TEST_DIR}/test.wav (220Hz sine, 3s)"
echo ""

# 2. Health check
echo "--- Step 2: Health check ---"
HEALTH=$(curl -s "${API_URL}/health")
echo "  Response: ${HEALTH}"
if echo "${HEALTH}" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['status']=='ok', 'bad health'" 2>/dev/null; then
    echo "  OK"
else
    echo "FAIL: health check failed"
    exit 1
fi
echo ""

# 3. Capabilities
echo "--- Step 3: Capabilities ---"
CAPS=$(curl -s "${API_URL}/api/capabilities")
PRESET_COUNT=$(echo "${CAPS}" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['presets']))" 2>/dev/null)
echo "  Presets available: ${PRESET_COUNT}"
if [ "${PRESET_COUNT}" -lt 8 ]; then
    echo "FAIL: expected 8+ presets, got ${PRESET_COUNT}"
    exit 1
fi
echo "  OK"
echo ""

# 4. Create a pack
echo "--- Step 4: Create pack (chaos_pack, chaos=1.0) ---"
PACK_RESPONSE=$(curl -s -X POST "${API_URL}/api/packs" \
    -F "files=@${TEST_DIR}/test.wav" \
    -F "preset=chaos_pack" \
    -F "chaos=1.0" \
    -F "output_format=wav" \
    -F "pack_name=smoke-test")

PACK_ID=$(echo "${PACK_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin)['pack_id'])" 2>/dev/null)
echo "  Pack ID: ${PACK_ID}"

if [ -z "${PACK_ID}" ] || [ "${PACK_ID}" = "null" ]; then
    echo "FAIL: no pack_id in response"
    echo "  Response: ${PACK_RESPONSE}"
    exit 1
fi
echo ""

# 5. Poll for completion (max 60 seconds)
echo "--- Step 5: Wait for completion ---"
TIMEOUT_SEC=60
START_TS=$(date +%s)
while true; do
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TS))
    if [ $ELAPSED -ge $TIMEOUT_SEC ]; then
        echo "FAIL: pack stuck processing for ${TIMEOUT_SEC}s (status=${STATUS:-unknown}, progress=${PROGRESS:-0})"
        echo "  Final response: ${STATUS_RESPONSE}"
        exit 1
    fi

    STATUS_RESPONSE=$(curl -s "${API_URL}/api/packs/${PACK_ID}")
    STATUS=$(echo "${STATUS_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "error")
    PROGRESS=$(echo "${STATUS_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin)['progress'])" 2>/dev/null || echo "0")
    echo "  [${ELAPSED}s] status=${STATUS} progress=${PROGRESS}"

    if [ "${STATUS}" = "completed" ]; then
        echo "  DONE"
        break
    elif [ "${STATUS}" = "failed" ]; then
        ERROR=$(echo "${STATUS_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null)
        echo "FAIL: pack generation failed: ${ERROR}"
        exit 1
    fi

    sleep 2
done
echo ""

# 6. Download and validate pack
echo "--- Step 6: Download pack ---"
HTTP_CODE=$(curl -s -o "${TEST_DIR}/pack.zip" -w "%{http_code}" "${API_URL}/api/packs/${PACK_ID}/download")
ZIP_SIZE=$(stat -f%z "${TEST_DIR}/pack.zip" 2>/dev/null || stat -c%s "${TEST_DIR}/pack.zip" 2>/dev/null)

echo "  HTTP status: ${HTTP_CODE}"
echo "  ZIP size: ${ZIP_SIZE} bytes"

if [ "${HTTP_CODE}" -ne 200 ] || [ "${ZIP_SIZE}" -lt 100 ]; then
    echo "FAIL: download failed or ZIP too small"
    echo "  Response body (first 200 chars):"
    head -c 200 "${TEST_DIR}/pack.zip"
    echo ""
    exit 1
fi

# Verify ZIP contents
echo "  ZIP contents:"
python3 -c "
import json, zipfile
with zipfile.ZipFile('${TEST_DIR}/pack.zip') as z:
    names = z.namelist()
    for n in names:
        print(f'    - {n}')
    assert any(n.endswith('.wav') for n in names), 'no WAV files'
    assert 'manifest.json' in names, 'no manifest'
    assert 'README.txt' in names, 'no README'
    print('  ZIP structure OK')
" 2>&1 || {
    echo "FAIL: ZIP validation failed"
    unzip -l "${TEST_DIR}/pack.zip" 2>/dev/null || echo "  (not a valid zip)"
    exit 1
}
echo ""

# 7. List packs
echo "--- Step 7: List packs ---"
LIST=$(curl -s "${API_URL}/api/packs?status=completed" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'  Total completed packs: {d[\"total\"]}')
print(f'  Items: {len(d[\"items\"])}')
")
echo "${LIST}"
echo ""

# 8. Delete pack
echo "--- Step 8: Delete pack ---"
DELETE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API_URL}/api/packs/${PACK_ID}")
echo "  HTTP status: ${DELETE_CODE}"
if [ "${DELETE_CODE}" -eq 204 ] || [ "${DELETE_CODE}" -eq 200 ]; then
    echo "  OK"
else
    echo "  WARN: unexpected delete status (not critical)"
fi
echo ""

echo "═══ Smoke test PASSED ═══"
rm -rf "${TEST_DIR}"
