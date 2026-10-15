#!/bin/bash
# Runs the Jest unit suite once a day and posts the result to Teams (see .env.example).
#
#   ./start-unit-test-report.sh [HH:MM] [--pull]
#
# HH:MM is the host's local time, 07:00 by default; on a UTC host run it with TZ=Pacific/Auckland.
# --pull fast-forwards the checkout first, so each report covers the latest code; only use it on a checkout
# kept for this. Needs GNU date (Linux or Git Bash).

RUN_AT="07:00"
PULL=false
for arg in "$@"; do
    case "$arg" in
        --pull) PULL=true ;;
        *) RUN_AT="$arg" ;;
    esac
done

cd "$(dirname "$0")" || exit 1

while true
    do
        now=$(date +%s)
        next=$(date -d "today $RUN_AT" +%s) || exit 1
        [ "$next" -le "$now" ] && next=$(date -d "tomorrow $RUN_AT" +%s)
        echo "next unit test report at: $(date -d "@$next")"
        sleep $((next - now))

        echo "start iteration: $(date)"
        if [ "$PULL" = true ]; then
            git pull --ff-only
        fi
        yarn install --frozen-lockfile && yarn prisma:generate && yarn test:report
        echo "end iteration"
    done
