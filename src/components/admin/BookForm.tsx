'use client';

import { EntityForm } from './EntityForm';
import { BookFormTabs } from './BookFormTabs';
import { CheckboxField, FieldSet, TextAreaField, TextField } from './Fields';
import { ImageField } from './ImageField';
import { BookImagesEditor } from './BookImagesEditor';
import { BookTocEditor } from './BookTocEditor';
import { BookPreviewGenerator } from './books/BookPreviewGenerator';
import { QuickAddSelect } from './QuickAddSelect';
import { RepeatableTextField } from './RepeatableTextField';
import { RichTextEditor } from './RichTextEditor';
import { TagPicker } from './TagPicker';
import { createAuthorQuick, createCategoryQuick, createSeriesQuick, createTag } from '@/lib/admin/actions';
import { computeCompletion } from '@/lib/completion';
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
  relations,
  images,
  toc,
  previewPages,
  storeEnabled,
  canWrite,
}: {
  book: Book | null;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  series: Series[];
  relations: BookRelations;
  /** גלריה, תוכן עניינים ודפי דוגמה — קיימים רק לספר שכבר נשמר (book !== null). */
  images: BookImage[];
  toc: BookTocEntry[];
  previewPages: BookPreviewPage[];
  /** קובע רק אם שדות המסחר מוצגים באתר הציבורי — בטופס הם ערוכים תמיד. */
  storeEnabled: boolean;
  canWrite: boolean;
}) {
  const languages = book?.languages ?? ['he'];
  const completion = book ? computeCompletion(book, relations) : null;

  return (
    <EntityForm
      entity="books"
      id={book?.id ?? null}
      canWrite={canWrite}
      backHref="/admin/books"
      stickyActions
    >
      {(errors) => (
        <>
          {/* המטבע קבוע לשלב זה; השדה נשלח כדי שהערך לא יימחק בעדכון */}
          <input type="hidden" name="currency" value={book?.currency ?? 'ILS'} />

          {completion ? (
            <div className="admin-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="admin-badge admin-badge-accent">
                  שלמות הרשומה: {completion.percent}%
                </span>
              </div>
              {completion.missing.length > 0 ? (
                <p className="mt-2 text-caption text-muted">
                  חסר: {completion.missing.map((item) => item.label).join(', ')}
                </p>
              ) : (
                <p className="mt-2 text-caption text-muted">כל השדות שהמד בודק מולאו.</p>
              )}
            </div>
          ) : null}

          <BookFormTabs
            firstErrorTab={
              errors.title_he || errors.slug
                ? 'basics'
                : errors.meta_title || errors.meta_description
                  ? 'identity'
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
                      <div className="grid gap-5 sm:grid-cols-2">
                        <TextField
                          name="slug"
                          label="מזהה כתובת"
                          dir="ltr"
                          defaultValue={book?.slug}
                          error={errors.slug}
                          hint="אפשר להשאיר ריק — ייווצר אוטומטית. /books/מזהה, אותיות לטיניות קטנות בלבד."
                        />
                        <TextField
                          name="subtitle_he"
                          label="כותרת משנה (עברית)"
                          defaultValue={book?.subtitle_he}
                        />
                      </div>
                    </FieldSet>

                    <FieldSet legend="שיוך" icon="categories">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <QuickAddSelect
                          name="author_id"
                          label="מחבר"
                          emptyLabel="— ללא —"
                          defaultValue={book?.author_id}
                          options={authors.map((author) => ({ value: author.id, label: author.name_he }))}
                          addLabel="+ מחבר חדש"
                          fieldLabel="שם המחבר"
                          onCreate={async (name) => {
                            const result = await createAuthorQuick(name);
                            return result.author
                              ? { value: result.author.id, label: result.author.name_he }
                              : null;
                          }}
                        />
                        <QuickAddSelect
                          name="category_id"
                          hint="המדף שעליו הספר יושב. זו הקטגוריה שמופיעה בכרטיס ובכתובת."
                          label="קטגוריה"
                          emptyLabel="— ללא —"
                          defaultValue={book?.category_id}
                          options={categories.map((category) => ({
                            value: category.id,
                            label: category.name_he,
                          }))}
                          addLabel="+ קטגוריה חדשה"
                          fieldLabel="שם הקטגוריה"
                          onCreate={async (name) => {
                            const result = await createCategoryQuick(name);
                            return result.category
                              ? { value: result.category.id, label: result.category.name_he }
                              : null;
                          }}
                        />
                      </div>
                    </FieldSet>

                    <FieldSet
                      legend="סדרה"
                      icon="series"
                      description="רק אם הספר הוא כרך בתוך מהדורה רב-כרכית. אפשר להשאיר ריק."
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
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
                        />
                        <TextField
                          name="series_position"
                          label="מיקום בסדרה"
                          type="number"
                          dir="ltr"
                          defaultValue={book?.series_position}
                          hint="כרך א׳ = 1, כרך ב׳ = 2 וכן הלאה."
                        />
                      </div>
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
                        <TextField name="format" label="פורמט" defaultValue={book?.format} />
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
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField name="title_en" label="Title" dir="ltr" defaultValue={book?.title_en} />
                      <TextField
                        name="subtitle_en"
                        label="Subtitle"
                        dir="ltr"
                        defaultValue={book?.subtitle_en}
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
                            pdfUrl={book.sample_pdf_url}
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
                label: 'קטגוריות ותגיות',
                icon: 'tags',
                hasError: false,
                content: (
                  <>
                    <FieldSet legend="קטגוריות נוספות" icon="categories">
                      <p className="text-caption text-muted">
                        אינן כפילות של הקטגוריה הראשית בלשונית &quot;פרטי יסוד&quot;: הראשית היא
                        המדף היחיד שבו הספר יושב, ומופיעה בכרטיס. כאן מסמנים מדפים{' '}
                        <em>נוספים</em> שבהם נכון שיימצא בסינון. אפשר להשאיר ריק.
                      </p>
                      <div className="mt-3 grid gap-1 sm:grid-cols-2">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center gap-2.5 py-1 text-small text-ink-soft"
                          >
                            <input
                              type="checkbox"
                              name="category_ids"
                              value={category.id}
                              defaultChecked={relations.categoryIds.includes(category.id)}
                              className="h-4 w-4 shrink-0 accent-[var(--admin-accent)]"
                            />
                            {category.name_he}
                          </label>
                        ))}
                      </div>
                    </FieldSet>

                    <FieldSet legend="תגיות" icon="tags">
                      <TagPicker
                        allTags={tags}
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
                hasError: false,
                content: (
                  <FieldSet
                    legend="מסחר"
                    icon="store"
                    description={
                      storeEnabled
                        ? 'המחירים מוצגים באתר בש״ח וכוללים מע״מ.'
                        : 'החנות עדיין כבויה באתר — אפשר להכין את הנתונים מראש, הם ייחשפו כשהיא תופעל.'
                    }
                  >
                    <div className="grid gap-5 sm:grid-cols-3">
                      <TextField name="price" label="מחיר" type="number" dir="ltr" defaultValue={book?.price} />
                      <TextField
                        name="stock_quantity"
                        label="מלאי"
                        type="number"
                        dir="ltr"
                        defaultValue={book?.stock_quantity}
                      />
                      <TextField
                        name="weight_grams"
                        label="משקל (גרם)"
                        type="number"
                        dir="ltr"
                        defaultValue={book?.weight_grams}
                        hint="משמש לחישוב משלוח."
                      />
                    </div>
                    <CheckboxField
                      name="is_purchasable"
                      label="ניתן לרכישה באתר"
                      defaultChecked={book?.is_purchasable ?? false}
                    />
                    <CheckboxField
                      name="preorder_enabled"
                      label="הזמנה מראש (בקרוב)"
                      defaultChecked={book?.preorder_enabled ?? false}
                      hint="מציג תג 'בקרוב' ומאפשר הזמנה מראש גם ללא מלאי."
                    />
                    <TextField
                      name="preorder_release_date"
                      label="תאריך יציאה משוער"
                      type="date"
                      dir="ltr"
                      defaultValue={book?.preorder_release_date ?? undefined}
                    />
                  </FieldSet>
                ),
              },
              {
                id: 'publish',
                label: 'פרסום',
                icon: 'check',
                hasError: false,
                content: (
                  <FieldSet legend="פרסום" icon="check">
                    <CheckboxField
                      name="is_published"
                      label="מפורסם באתר"
                      // ברירת המחדל לספר חדש היא מפורסם: "ברירת מחדל תמיד
                      // הספר בתצוגה באתר אלא אם נבחר אחרת". ספר קיים ממשיך
                      // להציג את המצב האמיתי שלו, לא מאופס למפורסם בכל עריכה.
                      defaultChecked={book ? book.is_published : true}
                      hint="ספר שאינו מפורסם נראה בממשק הניהול בלבד."
                    />
                    <CheckboxField
                      name="is_featured"
                      label="בחירת המכון"
                      defaultChecked={book?.is_featured ?? false}
                      hint="מציג תג 'בחירת המכון' בעמוד הספר."
                    />
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
