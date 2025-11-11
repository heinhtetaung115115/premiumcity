'use server';

import { hash } from 'bcryptjs';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { registrationSchema } from '@/utils/validators';

export async function registerUser(_: unknown, formData: FormData) {
  const result = registrationSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name')
  });

  if (!result.success) {
    return {
      success: false,
      error: 'Invalid form submission'
    };
  }

  const supabase = getServiceSupabaseClient();
  const email = result.data.email.toLowerCase();

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    return {
      success: false,
      error: existingError.message
    };
  }

  if (existing) {
    return {
      success: false,
      error: 'Email already registered'
    };
  }

  const { error } = await supabase.from('users').insert({
    email,
    name: result.data.name,
    password_hash: await hash(result.data.password, 10)
  });

  if (error) {
    return {
      success: false,
      error: error.message
    };
  }

  return { success: true };
}
