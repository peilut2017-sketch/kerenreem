#!/usr/bin/env bash
# הפעלת שרת בדיקה על פורט פנוי, אחרי כיבוי ודאי של קודמו.
#
# הרצת next start על פורט תפוס נכשלת, אבל התהליך הישן ממשיך לענות —
# ואז בדיקות ירוקות מתייחסות לבנייה ישנה לגמרי. לכן כאן: כיבוי, המתנה
# עד שהפורט באמת פנוי, הפעלה, ואימות שהתשובה מגיעה מהתהליך החדש.
set -u

PORT="${1:-3400}"
LOG="${2:-/var/tmp/kr-server.log}"

kill_port() {
  local pids
  pids=$(lsof -ti:"$1" 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
}

kill_port "$PORT"

# המתנה עד שהפורט משתחרר בפועל
for _ in $(seq 1 15); do
  lsof -ti:"$PORT" >/dev/null 2>&1 || break
  sleep 1
  kill_port "$PORT"
done

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "שגיאה: הפורט $PORT נשאר תפוס" >&2
  exit 1
fi

rm -f "$LOG"
npx next start -p "$PORT" > "$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 45); do
  # כשל הפעלה מזוהה מיד ולא אחרי timeout
  if grep -q "EADDRINUSE\|Failed to start" "$LOG" 2>/dev/null; then
    echo "שגיאה בהפעלת השרת:" >&2
    tail -6 "$LOG" >&2
    exit 1
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "שגיאה: תהליך השרת נפל" >&2
    tail -12 "$LOG" >&2
    exit 1
  fi
  if curl -sf -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
    echo "השרת עלה על פורט $PORT (pid $SERVER_PID)"
    exit 0
  fi
  sleep 1
done

echo "שגיאה: השרת לא ענה בתוך 45 שניות" >&2
tail -12 "$LOG" >&2
exit 1
