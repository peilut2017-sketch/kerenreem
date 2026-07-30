'use client';

import { EntityForm } from './EntityForm';
import { CheckboxField, FieldSet, SelectField, TextField } from './Fields';
import { ImageField } from './ImageField';
import { RichTextEditor } from './RichTextEditor';
import { TagPicker } from './TagPicker';
import { createTag } from '@/lib/admin/actions';
import type {
  AttributeWithValues,
  Author,
  Book,
  BookRelations,
  Category,
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
  relations,
  storeEnabled,
  canWrite,
}: {
  book: Book | null;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  relations: BookRelations;
  /** שדות המסחר מוסתרים עד להפעלת החנות — הם קיימים במסד גם בלעדיהם. */
  storeEnabled: boolean;
  canWrite: boolean;
}) {
  const languages = book?.languages ?? ['he'];
  return (
    <EntityForm entity="books" id={book?.id ?? null} canWrite={canWrite} backHref="/admin/books">
      {(errors) => (
        <>
          {/* המטבע קבוע לשלב זה; השדה נשלח כדי שהערך לא יימחק בעדכון */}
          <input type="hidden" name="currency" value={book?.currency ?? 'ILS'} />
          <FieldSet legend="זיהוי">
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
              required
              dir="ltr"
              defaultValue={book?.slug}
              error={errors.slug}
              hint="מופיע בכתובת העמוד: /books/מזהה. אותיות לטיניות קטנות, ספרות ומקפים."
            />
            <TextField
              name="subtitle_he"
              label="כותרת משנה (עברית)"
              defaultValue={book?.subtitle_he}
            />
          </FieldSet>

          <FieldSet legend="שיוך">
            <SelectField
              name="author_id"
              label="מחבר"
              emptyLabel="— ללא —"
              defaultValue={book?.author_id}
              options={authors.map((author) => ({ value: author.id, label: author.name_he }))}
            />
            <SelectField
              name="category_id"
              label="קטגוריה"
              emptyLabel="— ללא —"
              defaultValue={book?.category_id}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name_he,
              }))}
            />
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

          <FieldSet legend="תוכן">
            <RichTextEditor
              name="description_he"
              label="תיאור הספר (עברית)"
              defaultValue={book?.description_he}
            />
          </FieldSet>

          <FieldSet
            legend="אנגלית"
            description="אפשר להשאיר ריק. השדות קיימים כדי שהמילוי יהיה הדרגתי — מבקר אנגלי יראה את הנוסח העברי עד שימולאו."
          >
            <TextField name="title_en" label="Title" dir="ltr" defaultValue={book?.title_en} />
            <TextField name="subtitle_en" label="Subtitle" dir="ltr" defaultValue={book?.subtitle_en} />
            <RichTextEditor
              name="description_en"
              label="Description"
              defaultValue={book?.description_en}
            />
          </FieldSet>

          <FieldSet legend="קבצים">
            <ImageField
              name="cover_image_url"
              label="כריכה"
              bucket="covers"
              defaultValue={book?.cover_image_url}
              hint="עדיף צילום כריכה איכותי על רקע נקי. הכריכות הן האלמנט הוויזואלי המרכזי באתר."
            />
            <ImageField
              name="sample_pdf_url"
              label="דפדוף לדוגמה (PDF)"
              bucket="samples"
              accept="application/pdf"
              defaultValue={book?.sample_pdf_url}
            />
          </FieldSet>

          <FieldSet legend="מפרט המהדורה">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField name="pages" label="מספר עמודים" type="number" dir="ltr" defaultValue={book?.pages} />
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
            </div>
          </FieldSet>

          {storeEnabled ? (
            <FieldSet
              legend="מסחר"
              description="המחירים מוצגים באתר בש״ח וכוללים מע״מ."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField name="price" label="מחיר" type="number" dir="ltr" defaultValue={book?.price} />
                <TextField name="sku" label="מק״ט" dir="ltr" defaultValue={book?.sku} />
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
            </FieldSet>
          ) : (
            /* השדות נשלחים גם כשהחנות סגורה, כדי שערכים קיימים לא יימחקו בשמירה */
            <>
              <input type="hidden" name="price" value={book?.price ?? ''} />
              <input type="hidden" name="sku" value={book?.sku ?? ''} />
              <input type="hidden" name="stock_quantity" value={book?.stock_quantity ?? ''} />
              <input type="hidden" name="weight_grams" value={book?.weight_grams ?? ''} />
              {book?.is_purchasable ? (
                <input type="hidden" name="is_purchasable" value="true" />
              ) : null}
            </>
          )}

          <FieldSet legend="קטגוריות משניות">
            <p className="text-caption text-muted">
              הקטגוריה הראשית קובעת היכן הספר יושב. אלה מוסיפות היכן עוד אפשר
              למצוא אותו.
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
                    className="h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
                  />
                  {category.name_he}
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldSet legend="תגיות">
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
                    <legend className="field-label">{attribute.name_he}</legend>
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
                            className="h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
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

          <FieldSet legend="שפות">
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
                    className="h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
                  />
                  {language.label}
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldSet legend="חיפוש ומטא">
            <TextField
              name="cover_alt"
              label="טקסט חלופי לכריכה"
              defaultValue={book?.cover_alt}
              hint="ברירת המחדל היא שם הספר. כדאי למלא רק אם הכריכה נושאת מידע נוסף."
            />
            <TextField
              name="meta_title"
              label="כותרת לתוצאות חיפוש"
              defaultValue={book?.meta_title}
              hint="עד 70 תווים. ריק — ייעשה שימוש בשם הספר."
              error={errors.meta_title}
            />
            <TextField
              name="meta_description"
              label="תיאור לתוצאות חיפוש"
              defaultValue={book?.meta_description}
              hint="עד 160 תווים. טקסט ארוך יותר נחתך בגוגל באמצע משפט."
              error={errors.meta_description}
            />
            <TextField
              name="search_keywords"
              label="מונחי חיפוש נוספים"
              defaultValue={book?.search_keywords}
              hint="שמות נוספים שהספר מוכר בהם, מופרדים בפסיק. אינם מוצגים באתר."
            />
            <TextField
              name="canonical_url"
              label="כתובת קנונית"
              dir="ltr"
              defaultValue={book?.canonical_url}
              hint="רק אם אותו תוכן מתפרסם גם בכתובת אחרת."
            />
          </FieldSet>

          <FieldSet legend="פרסום">
            <CheckboxField
              name="is_published"
              label="מפורסם באתר"
              defaultChecked={book?.is_published ?? false}
              hint="ספר שאינו מפורסם נראה בממשק הניהול בלבד."
            />
            <TextField
              name="sort_order"
              label="סדר תצוגה"
              type="number"
              dir="ltr"
              defaultValue={book?.sort_order ?? 0}
              hint="מספר נמוך מופיע קודם."
            />
          </FieldSet>
        </>
      )}
    </EntityForm>
  );
}
