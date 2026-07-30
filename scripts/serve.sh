#!/usr/bin/env bash
# הפעלת שרת בדיקה, עם אימות שהתשובות מגיעות מהבנייה הנוכחית.
#
# הסכנה כאן אינה שהשרת לא יעלה, אלא ששרת ישן ימשיך לענות ובדיקות ירוקות
# יתייחסו לבנייה בת שעה. זה קרה בפועל: lsof אינו רואה שקעים בסביבה הזו,
# ולכן הכיבוי לפי פורט לא עשה דבר, והשאלה "האם השרת עונה" נענתה בהצלחה
# בידי התהליך הישן — שהגיש HTML המפנה ל-chunks שכבר אינם קיימים, כך
# שההידרציה נשברה וכל בדיקת אינטראקציה נכשלה בלי סיבה נראית לעין.
#
# לכן שתי שכבות: כיבוי גם לפי תבנית תהליך וגם לפי פורט, ואימות סופי מול
# BUILD_ID — מזהה שנוצר מחדש בכל בנייה ומוטמע ב-HTML. אם הוא אינו מופיע
# בתשובה, עונה כאן תהליך אחר, וזו שגיאה ולא הצלחה.
set -u

PORT="${1:-3400}"
LOG="${2:-/var/tmp/kr-server.log}"

BUILD_ID="$(cat .next/BUILD_ID 2>/dev/null || true)"
if [ -z "$BUILD_ID" ]; then
  echo "שגיאה: אין .next/BUILD_ID — יש להריץ next build קודם" >&2
  exit 1
fi

stop_servers() {
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
}

stop_servers
for _ in $(seq 1 10); do
  curl -sf -o /dev/null --max-time 1 "http://localhost:$PORT/" 2>/dev/null || break
  sleep 1
  stop_servers
done

rm -f "$LOG"
npx next start -p "$PORT" > "$LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 45); do
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

  # לא די בתשובה: היא חייבת להגיע מהבנייה שזה עתה נוצרה
  if curl -sf --max-time 3 "http://localhost:$PORT/" 2>/dev/null | grep -q "$BUILD_ID"; then
    echo "השרת עלה על פורט $PORT (pid $SERVER_PID, build $BUILD_ID)"
    exit 0
  fi
  sleep 1
done

echo "שגיאה: השרת לא הגיש את הבנייה הנוכחית ($BUILD_ID) בתוך 45 שניות" >&2
tail -12 "$LOG" >&2
exit 1
