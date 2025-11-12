'use server';

import { hash } from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { registrationSchema } from '@/utils/validators';

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function registerUser(
  _prevState: ActionResult,            // <-- accept prev state (unused)
  formData: FormData
): Promise<ActionResult> {
  const result = registrationSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });

  if (!result.success) {
    return { success: false, error: 'Invalid form submission' };
  }

  const email = String(result.data.email).toLowerCase().trim();
  const nameInput = result.data.name ? String(result.data.name).trim() : null;

  const supabase = getServiceSupabaseClient() as SupabaseClient<Database>;

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) return { success: false, error: existingError.message };
  if (existing) return { success: false, error: 'Email already registered' };

  const payload: Database['public']['Tables']['users']['Insert'] = {
    email,
    name: nameInput ?? null,
    password_hash: await hash(result.data.password, 10),
  };

  const { error } = await supabase.from('users').insert([payload]);
  if (error) return { success: false, error: error.message };

  return { success: true };
}
