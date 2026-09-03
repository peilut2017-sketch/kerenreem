'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminIcon } from './AdminIcons';
import { EntityForm } from './EntityForm';
import { BookFormTabs } from './BookFormTabs';
import { ToggleField, FieldSet, TextAreaField, TextField } from './Fields';
import { ImageField } from './ImageField';
import { BookImagesEditor } from './BookImagesEditor';
import { BookTocEditor } from './BookTocEditor';
import { BookPreviewGenerator } from './books/BookPreviewGenerator';
import { BookStorePreview } from './books/BookStorePreview';
import { AuthorForm } from './AuthorForm';
import { CategoryForm } from './CategoryForm';
import { QuickAddSelect } from './QuickAddSelect';
import { SeriesForm } from './SeriesForm';
import { RepeatableTextField } from './RepeatableTextField';
import { RelationPicker } from './RelationPicker';
import { RichTextEditor } from './RichTextEditor';
import { SeriesOrderList } from './SeriesOrderList';
import { createAuthorQuick, createCategoryQuick, createSeriesQuick, createTag } from '@/lib/admin/actions';
import { COMPLETION_TAB_LABELS, computeCompletion, type CompletionTab } from '@/lib/completion';
import { toCdnUrl } from '@/lib/image-src';
import type { SeriesMemberBook } from '@/lib/admin/queries';
import type {
  AttributeWithValues,
  Author,
  Book,
  BookImage,
  BookPreviewPage,
  BookRelations,
  BookTocEntry,
  Category,
  Series,
  Tag,
} from '@/lib/supabase/types';

import { formatAdminDate } from '@/lib/admin/reporting/format';
function formatDateTime(value: string): string {
  return formatAdminDate(value, 'dateTime');
}

/** רשימה סגורה: שפות אינן נערכות מהממשק ואין להן נתונים נלווים. */
const LANGUAGES = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'אנגלית' },
  { code: 'yi', label: 'יידיש' },
  { code: 'fr', label: 'צרפתית' },
  { code: 'ru', label: 'רוסית' },
  { code: 'es', label: 'ספרדית' },
];

export function BookForm({
  book,
  authors,
  categories,
  tags,
  attributes,
  series,
  seriesBooks,
  relations,
  images,
  toc,
  previewPages,
  storeEnabled,
  canWrite,
  stockOnHand,
}: {
  book: Book | null;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  series: Series[];
  /** [1.10] ספרים לפי סדרה, ממוינים לפי המיקום הנוכחי — לרשימת הגרירה של סדר הכרכים */
  seriesBooks: Record<string, SeriesMemberBook[]>;
  relations: BookRelations;
  /** גלריה, תוכן עניינים ודפי דוגמה — קיימים רק לספר שכבר נשמר (book !== null). */
  images: BookImage[];
  toc: BookTocEntry[];
  previewPages: BookPreviewPage[];
  /** קובע רק אם שדות המסחר מוצגים באתר הציבורי — בטופס הם ערוכים תמיד. */
  storeEnabled: boolean;
  canWrite: boolean;
  /** [1.4] on_hand אמיתי מכל המחסנים — לא book.stock_quantity (המטמון הזמין). */
  stockOnHand: number | null;
}) {
  const languages = book?.languages ?? ['he'];
  const completion = book
    ? computeCompletion(book, {
        ...relations,
        galleryCount: images.length,
        tocCount: toc.length,
        previewCount: previewPages.length,
      })
    : null;
  // "מה חסר" מקובץ לפי הלשונית שבה השדה נמצא — כך העורך יודע לאן לגשת
  const missingByTab = completion
    ? completion.missing.reduce<Map<CompletionTab, typeof completion.missing>>((map, item) => {
        const list = map.get(item.tab) ?? [];
        list.push(item);
        map.set(item.tab, list);
        return map;
      }, new Map())
    : null;
  const [selectedSeriesId, setSelectedSeriesId] = useState(book?.series_id ?? '');
  const [selectedAuthorId, setSelectedAuthorId] = useState(book?.author_id ?? '');
  // [1.21] הקטגוריה הראשית (book.category_id) חייבת להישאר ראשונה ברשימה
  // שנשלחת ל-RelationPicker: השרת גוזר ממנה מי "ראשית" לפי סדר ההגשה
  // (category_ids[0]) — ו-book_categories לא מבטיחה סדר שמתאים למה שהיה
  // category_id לפני כן. בלי הסידור הזה, שמירת ספר קיים בלי לגעת בכלל
  // בקטגוריות הייתה עלולה להחליף בשקט את הקטגוריה הראשית שלו.
  const orderedCategoryIds = book?.category_id
    ? [book.category_id, ...relations.categoryIds.filter((id) => id !== book.category_id)]
    : relations.categoryIds;

  // [1.26/1.32] "כריכה"/"פורמט"/"קהל יעד" מסוננים כבר במקור (listAttributes,
  // ראו src/lib/attributes.ts) — לא רק כאן, כדי שאותה הסתרה תחול גם על
  // הסינון הציבורי בקטלוג ולא רק על טופס הניהול.

  return (
    <EntityForm entity="books" id={book?.id ?? null} canWrite={canWrite} backHref="/admin/books">
      {(errors, { dirty }) => (
        <>
          {/* המטבע קבוע לשלב זה; השדה נשלח כדי שהערך לא יימחק בעדכון */}
          <input type="hidden" name="currency" value={book?.currency ?? 'ILS'} />

          {/* [1.27/1.34] חיווי "שינויים שלא נשמרו" + שמירה מהירה — צמוד
              לכותרת הכרטיס, ודביק (admin-unsaved-bar) כדי שיישאר גלוי גם
              בגלילה עמוקה בטופס הארוך, לא רק בראשו. אייקונים בלבד: אייקון
              מהבהב עם האזהרה כ-tooltip (לא באנר טקסט קבוע), ולצידו שמירה
              וסגירה — כדי שהפעולות הנפוצות ביותר תמיד בהישג יד בגלילה. */}
          {canWrite ? (
            <div className="admin-unsaved-bar">
              {dirty ? (
                <span title="יש שינויים שטרם נשמרו" className="inline-flex">
                  <AdminIcon name="warning" className="admin-unsaved-warning-icon h-4.5 w-4.5" />
                  <span className="sr-only" role="status">
                    יש שינויים שטרם נשמרו
                  </span>
                </span>
              ) : (
                <span className="sr-only" role="status">
                  כל השינויים נשמרו
                </span>
              )}
              <button
                type="submit"
                name="intent"
                value="save"
                title="שמירה מהירה"
                aria-label="שמירה מהירה"
                className="admin-btn admin-btn-icon admin-btn-solid"
              >
                <AdminIcon name="check" className="h-4 w-4" />
              </button>
              <Link href="/admin/books" title="סגירה" aria-label="סגירה" className="admin-btn admin-btn-icon admin-btn-quiet">
                <AdminIcon name="x" className="h-4 w-4" />
              </Link>
            </div>
          ) : null}

          {completion ? (
            <div className="admin-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="admin-badge admin-badge-accent">
                  שלמות הרשומה: {completion.percent}%
                </span>
              </div>
              {missingByTab && missingByTab.size > 0 ? (
                <div className="mt-2 space-y-1">
                  {/* בכל לשונית — ממוין מהניקוד הגבוה לנמוך (ראו completion.ts):
                      מה שהכי משתלם להשלים קודם מופיע ראשון. */}
                  {[...missingByTab.entries()].map(([tab, items]) => (
                    <p key={tab} className="text-caption text-muted">
                      <span className="font-semibold text-ink-soft">{COMPLETION_TAB_LABELS[tab]}:</span>{' '}
                      {items.map((item) => `${item.label} (${item.weight} נק')`).join(', ')}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-caption text-muted">כל השדות שהמד בודק מולאו.</p>
              )}
            </div>
          ) : null}

          <BookFormTabs
            firstErrorTab={
              errors.title_he || errors.slug || errors.sku
                ? 'basics'
                : errors.meta_title || errors.meta_description
                  ? 'identity'
                  : errors.price ||
                      errors.sale_price ||
                      errors.stock_quantity ||
                      errors.weight_grams ||
                      errors.low_stock_threshold ||
                      errors.external_supplier_url ||
                      errors.external_supplier_name
                    ? 'store'
                    : undefined
            }
            tabs={[
              {
                id: 'basics',
                label: 'פרטי יסוד',
                icon: 'books',
                hasError: Boolean(errors.title_he || errors.slug),
                content: (
                  <>
                    <FieldSet legend="זיהוי" icon="books">
                      <TextField
                        name="title_he"
                        label="שם הספר (עברית)"
                        required
                        defaultValue={book?.title_he}
                        error={errors.title_he}
                      />
                      <TextField
                        name="slug"
                        label="מזהה כתובת"
                        dir="auto"
                        defaultValue={book?.slug}
                        error={errors.slug}
                        hint="אפשר להשאיר ריק — ייווצר אוטומטית ותיוחד לספר (מבוסס מק״ט כשיש). /books/מזהה, אותיות לטיניות קטנות או עבריות, ספרות ומקפים."
                      />
                      <TextAreaField
                        name="subtitle_he"
                        label="כותרת משנה (עברית)"
                        rows={2}
                        defaultValue={book?.subtitle_he}
                      />
                    </FieldSet>

                    <FieldSet legend="שיוך" icon="categories">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <QuickAddSelect
                          name="author_id"
                          label="מחבר מהרשימה"
                          emptyLabel="— ללא —"
                          defaultValue={book?.author_id}
                          options={authors.map((author) => ({ value: author.id, label: author.name_he }))}
                          addLabel="+ מחבר חדש"
                          fieldLabel="שם המחבר"
                          hint="מחבר קיים בעל עמוד באתר. לבחירת ״ללא״ ייפתח שדה שם חופשי."
                          onCreate={async (name) => {
                            const result = await createAuthorQuick(name);
                            return result.author
                              ? { value: result.author.id, label: result.author.name_he }
                              : null;
                          }}
                          onChange={setSelectedAuthorId}
                          createForm={<AuthorForm author={null} bookCount={0} canWrite={canWrite} />}
                        />
                        {/* שדה השם החופשי מוצג רק כשנבחר "ללא" — מחבר מהרשימה
                            תמיד גובר, והשדה הנסתר מנקה שם חופשי ישן כדי שלא
                            ימשיך לעקוף את הבחירה בתצוגה. */}
                        {selectedAuthorId === '' ? (
                          <TextField
                            name="author_name_he"
                            label="שם מחבר כטקסט (עברית)"
                            defaultValue={book?.author_name_he}
                            hint="ללא שיוך לרשימת המחברים וללא קישור לעמוד מחבר. למילוי רק כשאין טעם ברשומת מחבר מלאה — עורך אורח, מחבר לא ידוע וכדו׳."
                          />
                        ) : (
                          <input type="hidden" name="author_name_he" value="" />
                        )}
                      </div>

                      <p className="admin-field-hint">
                        הקטגוריות נבחרות בלשונית &quot;קטגוריות ותגיות&quot; — הראשונה שתיבחר שם
                        היא זו שמופיעה בכרטיס ובכתובת (?category=).
                      </p>
                    </FieldSet>

                    <FieldSet
                      legend="סדרה"
                      icon="series"
                      description="רק אם הספר הוא כרך בתוך מהדורה רב-כרכית. אפשר להשאיר ריק."
                    >
                      <QuickAddSelect
                        name="series_id"
                        label="סדרה"
                        emptyLabel="— אינו חלק מסדרה —"
                        defaultValue={book?.series_id}
                        options={series.map((item) => ({ value: item.id, label: item.name_he }))}
                        addLabel="+ סדרה חדשה"
                        fieldLabel="שם הסדרה"
                        onCreate={async (name) => {
                          const result = await createSeriesQuick(name);
                          return result.series
                            ? { value: result.series.id, label: result.series.name_he }
                            : null;
                        }}
                        onChange={setSelectedSeriesId}
                        createForm={<SeriesForm series={null} bookCount={0} canWrite={canWrite} />}
                      />
                      {selectedSeriesId ? (
                        <div>
                          <span className="admin-field-label block">סדר הכרכים בסדרה</span>
                          <p className="admin-field-hint mb-3">
                            גררו לקביעת מקומו של הספר הזה בסדרה. ניתן לסדר מחדש גם אחרי השמירה.
                          </p>
                          {(() => {
                            const members = seriesBooks[selectedSeriesId] ?? [];
                            const isAlreadyMember = Boolean(book?.id) && members.some((m) => m.id === book!.id);
                            return (
                              <SeriesOrderList
                                seriesId={selectedSeriesId}
                                books={members.map((member) => ({
                                  id: member.id,
                                  title: member.title_he,
                                  coverUrl: member.cover_image_url,
                                }))}
                                pendingBookId={isAlreadyMember ? undefined : book?.id}
                                pendingBookTitle={book?.title_he || '(הספר הזה)'}
                              />
                            );
                          })()}
                        </div>
                      ) : null}
                    </FieldSet>

                    <FieldSet
                      legend="שנת הוצאה"
                      description="השנה העברית היא המקור התיעודי; הלועזית משלימה כשהיא ידועה. אפשר למלא אחת מהן בלבד."
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="publication_year_he"
                          label="שנה עברית"
                          placeholder="תשפ״ו"
                          defaultValue={book?.publication_year_he}
                        />
                        <TextField
                          name="publication_year_ce"
                          label="שנה לועזית"
                          type="number"
                          dir="ltr"
                          defaultValue={book?.publication_year_ce}
                        />
                      </div>
                    </FieldSet>

                    <FieldSet legend="תוכן" icon="pages">
                      <RichTextEditor
                        name="description_he"
                        label="תיאור הספר (עברית)"
                        defaultValue={book?.description_he}
                      />
                      <TextAreaField
                        name="description_brief_he"
                        label="תמצית קצרה (עברית)"
                        rows={3}
                        defaultValue={book?.description_brief_he}
                        hint="פסקה אחת קצרה — 'תמצית ב-30 שניות' לצד התיאור המלא בעמוד הספר. אפשר להשאיר ריק, ואז יוצג רק התיאור המלא."
                      />
                      <RepeatableTextField
                        name="quotes"
                        label="ציטוטים מתוך הספר"
                        defaultValues={book?.quotes ?? []}
                        multiline
                        placeholder="ציטוט אחד לכל שורה"
                        hint="מוצגים בעמוד הספר כקטע מודגש. אפשר להשאיר ריק."
                      />
                    </FieldSet>

                    <FieldSet
                      legend="אווירה (רשות)"
                      description="ברירת המחדל היא חילוץ צבע אוטומטי מהכריכה. למילוי רק אם הצבע שנחלץ אינו מתאים — פורמט #rrggbb."
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="accent_primary"
                          label="גוון ראשי"
                          dir="ltr"
                          placeholder="#c8a868"
                          defaultValue={book?.accent_primary}
                        />
                        <TextField
                          name="accent_secondary"
                          label="גוון משני"
                          dir="ltr"
                          placeholder="#0b1520"
                          defaultValue={book?.accent_secondary}
                        />
                      </div>
                    </FieldSet>
                  </>
                ),
              },
              {
                id: 'english',
                label: 'אנגלית',
                icon: 'globe',
                hasError: false,
                content: (
                  <FieldSet
                    legend="English"
                    icon="globe"
                    description="אפשר להשאיר ריק. השדות קיימים כדי שהמילוי יהיה הדרגתי — מבקר אנגלי יראה את הנוסח העברי עד שימולאו."
                  >
                    <TextAreaField
                      name="subtitle_en"
                      label="Subtitle"
                      dir="ltr"
                      rows={2}
                      defaultValue={book?.subtitle_en}
                    />
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField name="title_en" label="Title" dir="ltr" defaultValue={book?.title_en} />
                      <TextField
                        name="author_name_en"
                        label="Author (free text)"
                        dir="ltr"
                        defaultValue={book?.author_name_en}
                        hint="English version of the free-text author name above. Optional."
                      />
                      <TextField
                        name="publisher_en"
                        label="Publisher"
                        dir="ltr"
                        defaultValue={book?.publisher_en}
                      />
                      <TextField name="edition_en" label="Edition" dir="ltr" defaultValue={book?.edition_en} />
                    </div>
                    <RichTextEditor
                      name="description_en"
                      label="Description"
                      defaultValue={book?.description_en}
                    />
                    <TextAreaField
                      name="description_brief_en"
                      label="Brief summary"
                      rows={3}
                      defaultValue={book?.description_brief_en}
                    />
                  </FieldSet>
                ),
              },
              {
                id: 'images',
                label: 'תמונות',
                icon: 'image',
                hasError: false,
                content: (
                  <>
                    <FieldSet legend="קבצים" icon="image">
                      <ImageField
                        name="cover_image_url"
                        label="כריכה"
                        bucket="covers"
                        defaultValue={book?.cover_image_url}
                        hint="עדיף צילום כריכה איכותי על רקע נקי. הכריכות הן האלמנט הוויזואלי המרכזי באתר."
                      />
                      {/* שתי תמונות שונות ולשני מקומות שונים: שדרה שטוחה
                          למדף בעמוד הבית, והדמיה מרוכבת ל-Hero של עמוד
                          הספר. אחת אינה מחליפה את השנייה. */}
                      <ImageField
                        name="spine_image_url"
                        label="שדרה (רשות)"
                        bucket="covers"
                        defaultValue={book?.spine_image_url}
                        hint="צילום צר וגבוה של שדרת הספר, למדף בעמוד הבית. אם לא תועלה, השדרה תיגזר אוטומטית מהכריכה."
                      />
                      <ImageField
                        name="hero_mockup_url"
                        label="הדמיית כריכה ל-Hero"
                        bucket="covers"
                        accept="image/png,image/webp"
                        defaultValue={book?.hero_mockup_url}
                        hint={
                          'מומלץ להעלות PNG או WebP עם רקע שקוף, הכולל כריכה, שדרה ועובי ספר. ' +
                          'מומלץ 1400×1600 ומעלה, עד 2MB. אם השדה ריק תוצג הכריכה השטוחה. ' +
                          'אין לייצר את ההדמיה ב-AI — טקסט עברי על הכריכה משתבש.'
                        }
                      />
                      <ImageField
                        name="sample_pdf_url"
                        label="דפדוף לדוגמה (PDF)"
                        bucket="samples"
                        accept="application/pdf"
                        defaultValue={book?.sample_pdf_url}
                      />
                    </FieldSet>

                    {/* הגלריה ומחולל דפי הדוגמה שייכים לספר שכבר נשמר —
                        הם טבלאות נפרדות (book_images, book_preview_pages)
                        עם פעולת שמירה משלהן, ולא ניתן לצרף אליהן שורות
                        לפני שיש book_id. ראו BookImagesEditor/BookPreviewGenerator. */}
                    {book ? (
                      <>
                        <FieldSet legend="גלריית תמונות" icon="image">
                          <BookImagesEditor bookId={book.id} images={images} />
                        </FieldSet>

                        <FieldSet
                          legend="דפי דוגמה לדפדוף"
                          icon="books"
                          description="ממיר עמודים מה-PDF שהועלה למעלה לתמונות, לדפדוף המוחשי בעמוד הספר."
                        >
                          <BookPreviewGenerator
                            bookId={book.id}
                            pdfUrl={book.sample_pdf_url ? toCdnUrl(book.sample_pdf_url) : book.sample_pdf_url}
                            existingPages={previewPages}
                          />
                        </FieldSet>
                      </>
                    ) : (
                      <p className="admin-badge admin-badge-neutral">
                        גלריית התמונות ודפי הדוגמה לדפדוף ייפתחו כאן לאחר השמירה הראשונה של הספר.
                      </p>
                    )}
                  </>
                ),
              },
              {
                id: 'toc',
                label: 'תוכן עניינים',
                icon: 'list',
                hasError: false,
                content: book ? (
                  <FieldSet legend="תוכן עניינים" icon="list">
                    <BookTocEditor bookId={book.id} entries={toc} />
                  </FieldSet>
                ) : (
                  <p className="admin-badge admin-badge-neutral">
                    תוכן העניינים ייפתח כאן לאחר השמירה הראשונה של הספר.
                  </p>
                ),
              },
              {
                id: 'taxonomy',
                label: 'מפרט הספר',
                icon: 'tags',
                hasError: false,
                content: (
                  <>
                    <FieldSet legend="קטגוריות" icon="categories">
                      <p className="text-caption text-muted">
                        המדפים שבהם הספר יימצא — בכרטיס, בסינון הקטלוג ובעמוד הספר.
                        הראשונה שתיבחר היא הקטגוריה הראשית (פירורי לחם, כתובת ?category=).
                      </p>
                      <div className="mt-3">
                        <RelationPicker
                          fieldName="category_ids"
                          label="קטגוריות קיימות — לחיצה לבחירה"
                          placeholder="הלכה, מועדים, מחשבה…"
                          itemLabel="קטגוריה"
                          allItems={categories}
                          selectedIds={orderedCategoryIds}
                          primaryBadge
                          allVisible
                          createForm={<CategoryForm category={null} bookCount={0} canWrite={canWrite} />}
                          onCreate={async (name) => {
                            const result = await createCategoryQuick(name);
                            return result.category ?? null;
                          }}
                        />
                      </div>
                    </FieldSet>

                    <FieldSet legend="תגיות" icon="tags">
                      <RelationPicker
                        fieldName="tag_ids"
                        label="הוספת תגית"
                        placeholder="שבת, טהרה, ילדים…"
                        itemLabel="תגית"
                        allItems={tags}
                        selectedIds={relations.tagIds}
                        onCreate={async (name) => {
                          const result = await createTag(name);
                          return result.tag ?? null;
                        }}
                      />
                    </FieldSet>

                    {attributes.length > 0 ? (
                      <FieldSet legend="מאפיינים">
                        <div className="space-y-5">
                          {attributes.map((attribute) => (
                            <fieldset key={attribute.id}>
                              <legend className="admin-field-label">{attribute.name_he}</legend>
                              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                                {attribute.values.map((value) => (
                                  <label
                                    key={value.id}
                                    className="flex items-center gap-2.5 py-1 text-small text-ink-soft"
                                  >
                                    <input
                                      /* radio למאפיין חד-ערכי, checkbox לרב-ערכי —
                                         אותו שם שדה בשני המקרים, ולכן השמירה גנרית */
                                      type={attribute.is_multi ? 'checkbox' : 'radio'}
                                      name="attribute_value_ids"
                                      value={value.id}
                                      defaultChecked={relations.attributeValueIds.includes(value.id)}
                                      className="h-4 w-4 shrink-0 accent-[var(--admin-accent)]"
                                    />
                                    {value.name_he}
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          ))}
                        </div>
                      </FieldSet>
                    ) : null}

                    <FieldSet legend="שפות" icon="globe">
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        {LANGUAGES.map((language) => (
                          <label
                            key={language.code}
                            className="flex items-center gap-2.5 py-1 text-small text-ink-soft"
                          >
                            <input
                              type="checkbox"
                              name="languages"
                              value={language.code}
                              defaultChecked={languages.includes(language.code)}
                              className="h-4 w-4 shrink-0 accent-[var(--admin-accent)]"
                            />
                            {language.label}
                          </label>
                        ))}
                      </div>
                    </FieldSet>

                    {/* [1.26] הועבר מ"פרטי יסוד" — פרטים פיזיים של המהדורה
                        שייכים יחד עם שאר סיווג הספר, לא עם הזיהוי הבסיסי שלו. */}
                    <FieldSet legend="מפרט המהדורה" icon="list">
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <TextField name="publisher_he" label="הוצאה לאור" defaultValue={book?.publisher_he} />
                        <TextField name="edition_he" label="מהדורה" defaultValue={book?.edition_he} />
                        <TextField
                          name="pages"
                          label="מספר עמודים"
                          type="number"
                          dir="ltr"
                          defaultValue={book?.pages}
                        />
                        <TextField
                          name="volume_count"
                          label="מספר כרכים"
                          type="number"
                          dir="ltr"
                          defaultValue={book?.volume_count ?? 1}
                        />
                        <TextField name="binding" label="כריכה" defaultValue={book?.binding} />
                        <TextField name="isbn" label="מסת״ב" dir="ltr" defaultValue={book?.isbn} />
                        <TextField
                          name="sku"
                          label="מק״ט"
                          dir="ltr"
                          defaultValue={book?.sku}
                          hint="מוצג בעמוד הספר."
                        />
                      </div>
                    </FieldSet>
                  </>
                ),
              },
              {
                id: 'identity',
                label: 'זיהוי וחיפוש',
                icon: 'search',
                hasError: Boolean(errors.meta_title || errors.meta_description),
                content: (
                  <>
                    {book ? (
                      <FieldSet legend="מזהה פנימי">
                        <code
                          dir="ltr"
                          className="block overflow-x-auto rounded-[var(--admin-radius-btn)] bg-cream-2 px-3 py-2 text-caption text-ink-soft"
                        >
                          {book.id}
                        </code>
                        <span className="admin-field-hint">
                          מזהה קבוע שאינו משתנה גם אם שם הספר או הכתובת משתנים. שימושי להפניה
                          מדויקת לספר.
                        </span>
                      </FieldSet>
                    ) : null}

                    <FieldSet legend="חיפוש ומטא" icon="search">
                      <p className="mb-3 text-caption leading-relaxed text-muted">
                        השדות כאן אינם מחליפים את התוכן שבלשונית &quot;פרטי יסוד&quot;. שם
                        הספר, כותרת המשנה והתיאור הם מה שמנועי החיפוש קוראים בפועל — אלה רק
                        עוקפים אותם כשצריך ניסוח אחר לתוצאות החיפוש. אפשר להשאיר את כולם
                        ריקים.
                      </p>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="cover_alt"
                          label="טקסט חלופי לכריכה"
                          defaultValue={book?.cover_alt}
                          hint="ברירת המחדל היא שם הספר."
                        />
                        <TextField
                          name="meta_title"
                          label="כותרת לתוצאות חיפוש"
                          defaultValue={book?.meta_title}
                          hint="עד 70 תווים. ריק — ייעשה שימוש בשם הספר."
                          error={errors.meta_title}
                        />
                      </div>
                      <TextField
                        name="meta_description"
                        label="תיאור לתוצאות חיפוש"
                        defaultValue={book?.meta_description}
                        hint="עד 160 תווים. טקסט ארוך יותר נחתך בגוגל באמצע משפט."
                        error={errors.meta_description}
                      />
                      <TextField
                        name="search_keywords"
                        label="מונחי חיפוש פנימיים"
                        defaultValue={book?.search_keywords}
                        hint={
                          'שמות וכינויים נוספים שהספר מוכר בהם, מופרדים בפסיק. משפיעים על ' +
                          'החיפוש באתר בלבד ואינם מוצגים בעמוד. גוגל מתעלם ממילות מפתח ' +
                          'מוסתרות מאז 2009, ולכן זה אינו כלי קידום.'
                        }
                      />
                      <TextField
                        name="canonical_url"
                        label="כתובת קנונית"
                        dir="ltr"
                        defaultValue={book?.canonical_url}
                        hint="רק אם אותו תוכן מתפרסם גם בכתובת אחרת."
                      />
                    </FieldSet>
                  </>
                ),
              },
              {
                id: 'store',
                label: 'מסחר',
                icon: 'store',
                hasError: Boolean(
                  errors.price ||
                    errors.sale_price ||
                    errors.stock_quantity ||
                    errors.weight_grams ||
                    errors.low_stock_threshold ||
                    errors.external_supplier_url ||
                    errors.external_supplier_name,
                ),
                content: (
                  <BookStorePreview
                    coverUrl={book?.cover_image_url}
                    title={book?.title_he ?? ''}
                    storeEnabled={storeEnabled}
                    initial={{
                      price: book?.price ?? null,
                      salePrice: book?.sale_price ?? null,
                      saleStartsAt: book?.sale_starts_at?.slice(0, 10) ?? null,
                      saleEndsAt: book?.sale_ends_at?.slice(0, 10) ?? null,
                      saleName: book?.sale_name_he ?? null,
                      isPurchasable: book?.is_purchasable ?? false,
                      preorderEnabled: book?.preorder_enabled ?? false,
                      preorderReleaseDate: book?.preorder_release_date ?? null,
                      stockQuantity: stockOnHand ?? book?.stock_quantity ?? 0,
                      prepDaysOverride: book?.prep_days_override ?? null,
                    }}
                  >
                    <FieldSet
                      legend="מחיר"
                      icon="finance"
                      description={
                        storeEnabled
                          ? 'המחיר מוצג באתר בש״ח וכולל מע״מ.'
                          : 'החנות עדיין כבויה באתר — אפשר להכין את הנתונים מראש, הם ייחשפו כשהיא תופעל.'
                      }
                    >
                      <TextField
                        name="price"
                        label="מחיר"
                        type="number"
                        dir="ltr"
                        min={0}
                        step={0.5}
                        defaultValue={book?.price}
                        error={errors.price}
                      />
                    </FieldSet>

                    <FieldSet
                      legend="מבצע"
                      icon="store"
                      description="מחיר מבצע בתוך חלון התאריכים גובר על המחיר הרגיל. ההזמנה שומרת את שני המחירים כפי שהיו בעת הרכישה."
                    >
                      <div className="grid gap-5 sm:grid-cols-3">
                        <TextField
                          name="sale_price"
                          label="מחיר מבצע"
                          type="number"
                          dir="ltr"
                          min={0}
                          step={0.5}
                          defaultValue={book?.sale_price}
                          error={errors.sale_price}
                        />
                        <TextField
                          name="sale_starts_at"
                          label="מתחיל בתאריך"
                          type="date"
                          dir="ltr"
                          defaultValue={book?.sale_starts_at?.slice(0, 10) ?? undefined}
                        />
                        <TextField
                          name="sale_ends_at"
                          label="מסתיים בתאריך"
                          type="date"
                          dir="ltr"
                          defaultValue={book?.sale_ends_at?.slice(0, 10) ?? undefined}
                        />
                      </div>
                      <TextField
                        name="sale_name_he"
                        label="שם המבצע"
                        defaultValue={book?.sale_name_he}
                        hint="מוצג ליד המחיר, למשל ״מבצע השקה״. רשות."
                      />
                    </FieldSet>

                    <FieldSet legend="מלאי" icon="inventory">
                      {book ? (
                        <div>
                          <span className="admin-field-label">מלאי פיזי (סה״כ בכל המחסנים)</span>
                          <div className="mt-1 flex flex-wrap items-center gap-3 rounded-[var(--admin-radius-btn)] border border-rule bg-cream-2 px-3 py-2.5">
                            <span className="font-serif text-h3 tabular-nums text-ink">
                              {(stockOnHand ?? book.stock_quantity ?? 0).toLocaleString('he-IL')}
                            </span>
                            <Link href="/admin/inventory" className="admin-btn admin-btn-quiet ms-auto">
                              עדכון במסך המלאי ←
                            </Link>
                          </div>
                          <span className="admin-field-hint">
                            מלאי מתעדכן רק דרך מסך המלאי מכאן ואילך — כדי לשמור סיבה, מיקום פר-מחסן ותיעוד מדויק
                            לכל שינוי בפועל. עלות ליחידה — בפאנל שבתחתית העמוד.
                          </span>
                        </div>
                      ) : (
                        <TextField
                          name="stock_quantity"
                          label="מלאי פתיחה"
                          type="number"
                          dir="ltr"
                          min={0}
                          step={1}
                          error={errors.stock_quantity}
                          hint="כמות המלאי בהקמת הספר. ריק = 0. עדכוני מלאי מכאן ואילך — במסך המלאי בלבד."
                        />
                      )}
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="low_stock_threshold"
                          label="סף מלאי נמוך לספר"
                          type="number"
                          dir="ltr"
                          min={0}
                          step={1}
                          defaultValue={book?.low_stock_threshold}
                          error={errors.low_stock_threshold}
                          hint="ריק = הסף הכללי שבהגדרות החנות."
                        />
                        <TextField
                          name="stock_location"
                          label="מיקום מדף (בתוך המחסן)"
                          defaultValue={book?.stock_location}
                          hint="מיקום המלאי הפיזי, למשל ״מדף A3״ — לצוות בלבד, לא מוצג באתר."
                        />
                      </div>
                      <ToggleField
                        name="is_stock_managed"
                        label="מלאי מנוהל"
                        defaultChecked={book?.is_stock_managed ?? true}
                        hint="ביטול = מלאי בלתי מוגבל: אין שמירה ואין הפחתה במכירה."
                        entityKey="books"
                        id={book?.id}
                      />
                    </FieldSet>

                    <FieldSet legend="משלוח" icon="shipping">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="weight_grams"
                          label="משקל (גרם)"
                          type="number"
                          dir="ltr"
                          min={0}
                          step={1}
                          defaultValue={book?.weight_grams}
                          error={errors.weight_grams}
                          hint="משמש לחישוב משלוח."
                        />
                        <TextField
                          name="physical_size"
                          label="גודל"
                          defaultValue={book?.physical_size}
                          hint="מידות הספר, למשל 17x24 ס״מ."
                        />
                      </div>
                      <ToggleField
                        name="free_shipping_eligible"
                        label="נספר לסף משלוח חינם"
                        defaultChecked={book?.free_shipping_eligible ?? true}
                        entityKey="books"
                        id={book?.id}
                      />
                    </FieldSet>

                    <FieldSet legend="רכישה" icon="store">
                      <ToggleField
                        name="is_purchasable"
                        label="ניתן לרכישה באתר"
                        defaultChecked={book?.is_purchasable ?? false}
                        hint="מחייב מחיר. בלי מחיר — השמירה תיעצר."
                        entityKey="books"
                        id={book?.id}
                      />
                    </FieldSet>

                    <FieldSet
                      legend="רכישה דרך ספק חיצוני"
                      icon="external"
                      description="ספר שנמכר (גם, או רק) דרך גורם אחר — למשל הוצאה חיצונית. בעמוד הספר יופיע כפתור לרכישה אצל הספק, לצד ההזמנה אצלנו או במקומה."
                    >
                      <ToggleField
                        name="external_supplier_enabled"
                        label="מכירה דרך ספק חיצוני"
                        defaultChecked={book?.external_supplier_enabled ?? false}
                        hint="כשמופעל: ספר זה נמכר דרך ספק חיצוני ולא (רק) דרך קרן רא״ם — הכפתור בעמוד הספר יפנה החוצה לקישור שבשדה שלמטה."
                        entityKey="books"
                        id={book?.id}
                      />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="external_supplier_url"
                          label="קישור לרכישה אצל הספק"
                          type="url"
                          dir="ltr"
                          defaultValue={book?.external_supplier_url}
                          error={errors.external_supplier_url}
                        />
                        <TextField
                          name="external_supplier_name"
                          label="שם הספק"
                          defaultValue={book?.external_supplier_name}
                          error={errors.external_supplier_name}
                          hint="מוצג בטקסט הכפתור, למשל ״רכישה דרך יד שרה״."
                        />
                      </div>
                      <ToggleField
                        name="external_supplier_always_show"
                        label="הצג גם כשנמכר אצלנו"
                        defaultChecked={book?.external_supplier_always_show ?? false}
                        hint="ברירת מחדל: הכפתור מוצג רק כשהספר אינו ניתן לרכישה אצלנו בפועל (לא מסומן לרכישה, או שהחנות כבויה). הפעילו כדי להציג אותו גם כשהוא כן נמכר אצלנו."
                        entityKey="books"
                        id={book?.id}
                      />
                    </FieldSet>

                    <FieldSet
                      legend="הזמנה מראש"
                      icon="events"
                      description="מציג תג 'בקרוב' ומאפשר הזמנה מראש גם ללא מלאי."
                    >
                      <ToggleField
                        name="preorder_enabled"
                        label="הזמנה מראש (בקרוב)"
                        defaultChecked={book?.preorder_enabled ?? false}
                        entityKey="books"
                        id={book?.id}
                      />
                      <TextField
                        name="preorder_release_date"
                        label="תאריך יציאה משוער"
                        type="date"
                        dir="ltr"
                        defaultValue={book?.preorder_release_date ?? undefined}
                      />
                    </FieldSet>

                    <FieldSet legend="זיהוי" icon="tags">
                      <TextField
                        name="barcode"
                        label="ברקוד"
                        dir="ltr"
                        defaultValue={book?.barcode}
                        hint="ברקוד נפרד ממסת״ב וממק״ט, אם קיים."
                      />
                    </FieldSet>
                  </BookStorePreview>
                ),
              },
              {
                id: 'publish',
                label: 'פרסום',
                icon: 'check',
                hasError: false,
                content: (
                  <FieldSet legend="פרסום" icon="check">
                    <ToggleField
                      name="is_published"
                      label="מפורסם באתר"
                      // ברירת המחדל לספר חדש היא מפורסם: "ברירת מחדל תמיד
                      // הספר בתצוגה באתר אלא אם נבחר אחרת". ספר קיים ממשיך
                      // להציג את המצב האמיתי שלו, לא מאופס למפורסם בכל עריכה.
                      defaultChecked={book ? book.is_published : true}
                      hint="ספר שאינו מפורסם נראה בממשק הניהול בלבד."
                      entityKey="books"
                      id={book?.id}
                    />
                    <ToggleField
                      name="is_featured"
                      label="בחירת המכון"
                      defaultChecked={book?.is_featured ?? false}
                      hint="מציג תג 'בחירת המכון' בעמוד הספר."
                      entityKey="books"
                      id={book?.id}
                    />

                    {book ? (
                      <dl className="grid gap-3 border-t border-rule pt-5 text-caption text-muted sm:grid-cols-2">
                        <div>
                          <dt className="text-ink-soft">נוצר</dt>
                          <dd className="tabular-nums">{formatDateTime(book.created_at)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-soft">עודכן לאחרונה</dt>
                          <dd className="tabular-nums">{formatDateTime(book.updated_at)}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </FieldSet>
                ),
              },
            ]}
          />
        </>
      )}
    </EntityForm>
  );
}
