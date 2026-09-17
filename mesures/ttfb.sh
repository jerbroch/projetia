#!/bin/bash
# TTFB médian sur N passages, avec la session du compte de mesure.
COOKIE="$1"; N="${2:-7}"
mesurer() {
  local url="$1" ; local t=()
  for i in $(seq 1 "$N"); do
    v=$(curl -s -o /dev/null -w "%{time_starttransfer}" -b "$COOKIE" "$url" --max-time 30)
    t+=("$(echo "$v * 1000" | bc | cut -d. -f1)")
  done
  printf '%s\n' "${t[@]}" | sort -n | awk -v n="$N" 'NR==int((n+1)/2){print $1}'
}
for r in /login /dashboard /customers /quotes /invoices /schedule /outillage /heures; do
  printf "  %-12s %5s ms\n" "$r" "$(mesurer "http://localhost:3000$r")"
done
