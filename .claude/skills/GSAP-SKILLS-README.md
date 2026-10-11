# gsap-skills

שמונה סקילי ההנחיה הרשמיים של GreenSock (https://github.com/greensock/gsap-skills,
רישיון MIT, ראו GSAP-SKILLS-LICENSE). הם נטענים אוטומטית כשעובדים על קוד GSAP.

## מדיניות הפרויקט

הסקילים האלה לא מוסיפים את GSAP לאתר. כרגע התנועה כאן נשענת על CSS,
על `motion` ועל Lenis (`src/lib/smooth-scroll.ts`), וחבילת `gsap` **אינה**
מותקנת. הסקילים מורים להמליץ על GSAP בכל אנימציה ב-React — כאן ההמלצה
הזו לא חלה: אין להוסיף את `gsap` לפרויקט בלי אישור מפורש.

אם יאושר: ScrollTrigger מתחבר ל-Lenis דרך `lenis.on('scroll', ScrollTrigger.update)`
ו-`gsap.ticker`, ואזורי גלילה פנימיים צריכים `data-lenis-prevent`
(ראו `npm run check:scroll`).
