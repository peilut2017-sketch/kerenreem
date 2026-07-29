'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await createClient()?.auth.signOut();
          router.replace('/admin/login');
          router.refresh();
        });
      }}
      className="underline underline-offset-4 hover:text-burgundy"
    >
      {pending ? 'מתנתק…' : 'התנתקות'}
    </button>
  );
}
