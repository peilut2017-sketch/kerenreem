#!/usr/bin/env bash
# הפעלת שרת בדיקה על פורט פנוי, אחרי כיבוי ודאי של קודמו.
#
# הרצת next start על פורט תפוס נכשלת בשקט — התהליך הישן ממשיך להגיש
# בנייה ישנה, ואז בדיקות מראות תוצאות שאינן קשורות לקוד הנוכחי.
set -u

PORT="${1:-3400}"
LOG="${2:-/var/tmp/kr-server.log}"

# כיבוי כל מי שמחזיק את הפורט
PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  kill -9 $PIDS 2>/dev/null || true
  sleep 2
fi

if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "שגיאה: הפורט $PORT עדיין תפוס" >&2
  exit 1
fi

rm -f "$LOG"
npx next start -p "$PORT" > "$LOG" 2>&1 &

# המתנה עד שהשרת עונה בפועל
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
    echo "השרת עלה על פורט $PORT"
    exit 0
  fi
  if grep -q "EADDRINUSE\|Failed to start" "$LOG" 2>/dev/null; then
    echo "שגיאה בהפעלת השרת:" >&2
    tail -5 "$LOG" >&2
    exit 1
  fi
  sleep 1
done

echo "שגיאה: השרת לא ענה בתוך 40 שניות" >&2
tail -10 "$LOG" >&2
exit 1
