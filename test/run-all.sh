#!/bin/bash
# Runs every test and prints a summary. From the top folder:  bash test/run-all.sh
# Starts a local web server on port 8765 if one isn't already running.
cd "$(dirname "$0")/.." || exit 1
started=""
if ! curl -s -o /dev/null http://127.0.0.1:8765/; then
  python3 -m http.server 8765 >/dev/null 2>&1 &
  started=$!
  sleep 1
fi
pass=0; fail=0; failed=""
for f in test/*.js; do
  n=$(basename "$f" .js)
  out=$(timeout 900 node "$f" 2>&1); code=$?
  last=$(echo "$out" | grep -E "checks passed" | tail -1)
  bad=$(echo "$out" | grep -E "^FAIL|^FAIL | FAIL |PROBLEMS: \[" | head -5)
  if [ $code -eq 0 ] && [ -z "$bad" ]; then
    echo "ok    $n  $last"; pass=$((pass + 1))
  else
    echo "FAIL  $n  $last (exit $code)"; [ -n "$bad" ] && echo "$bad" | sed 's/^/        /'
    fail=$((fail + 1)); failed="$failed $n"
  fi
done
[ -n "$started" ] && kill "$started" 2>/dev/null
echo
echo "$pass passed, $fail failed${failed:+:$failed}"
[ $fail -eq 0 ]
