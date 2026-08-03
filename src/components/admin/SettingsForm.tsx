'use client';

import { useActionState } from 'react';
import { saveSettings, type SettingsState } from '@/lib/admin/settings-actions';
import { FieldSet, TextField } from './Fields';
import { ImageField } from './ImageField';
import type { SiteSettings } from '@/lib/supabase/types';

const INITIAL: SettingsState = { status: 'idle' };

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSettings, INITIAL);
  const contact = settings.contact ?? {};
  const social = settings.social_links ?? {};

  return (
    <form action={action} className="space-y-8">
      <FieldSet legend="זהות">
        <ImageField name="logo_url" label="לוגו" bucket="site" defaultValue={settings.logo_url} />
        <ImageField
          name="logo_dark_url"
          label="לוגו לרקע כהה (רשות)"
          bucket="site"
          defaultValue={settings.logo_dark_url}
          hint={
            'גרסה הפוכה/בהירה של הלוגו, לתחתית האתר ולרצועות הכהות. ' +
            'ריק — הלוגו הרגיל יוצג שם על גבי משטח בהיר קטן, כדי שיישאר קריא.'
          }
        />
      </FieldSet>

      <FieldSet legend="פרטי קשר">
        <TextField name="address_he" label="כתובת (עברית)" defaultValue={contact.address_he} />
        <TextField name="address_en" label="Address" dir="ltr" defaultValue={contact.address_en} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="phone" label="טלפון" dir="ltr" defaultValue={contact.phone} />
          <TextField name="email" label="דואר אלקטרוני" type="email" dir="ltr" defaultValue={contact.email} />
        </div>
      </FieldSet>

      <FieldSet
        legend="פרטים לעמודי החובה"
        description="מופיעים בתקנון, במדיניות הפרטיות ובהצהרת הנגישות. חובה למלא לפני עלייה לאוויר."
      >
        <TextField
          name="registration_number"
          label="שם העמותה ומספר רישום"
          defaultValue={contact.registration_number}
          hint="לדוגמה: קרן רא״ם (ע״ר) 58-0000000"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="privacy_officer"
            label="ממונה פרטיות"
            defaultValue={contact.privacy_officer}
            hint="שם ופרטי קשר — נדרש בתיקון 13."
          />
          <TextField
            name="accessibility_officer"
            label="רכז נגישות"
            defaultValue={contact.accessibility_officer}
            hint="שם ופרטי קשר — נדרש בתקן 5568."
          />
        </div>
      </FieldSet>

      <FieldSet legend="רשתות">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="social_facebook" label="Facebook" type="url" dir="ltr" defaultValue={social.facebook} />
          <TextField name="social_youtube" label="YouTube" type="url" dir="ltr" defaultValue={social.youtube} />
          <TextField name="social_instagram" label="Instagram" type="url" dir="ltr" defaultValue={social.instagram} />
          <TextField name="social_x" label="X" type="url" dir="ltr" defaultValue={social.x} />
        </div>
      </FieldSet>

      {state.status === 'error' ? (
        <p role="alert" className="admin-card border-s-2 border-s-[var(--admin-danger)] px-4 py-3 text-small">
          {state.message}
        </p>
      ) : null}
      {state.status === 'saved' ? (
        <p role="status" className="admin-badge admin-badge-success">
          <span className="admin-badge-dot" aria-hidden="true" />
          ההגדרות נשמרו
        </p>
      ) : null}

      <div className="border-t border-rule pt-6">
        <button type="submit" disabled={pending} className="admin-btn admin-btn-solid">
          {pending ? 'שומר…' : 'שמירה'}
        </button>
      </div>
    </form>
  );
}
