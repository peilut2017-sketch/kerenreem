/**
 * רישום ה-hook (alias-hooks.mjs) דרך module.register — נטען עם ‎--import‎
 * לפני קובץ הבדיקה, כדי שפתרון ה-alias יחול על כל הייבוא שלו.
 */
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
