'use server';

import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
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

  const existing = await prisma.user.findUnique({ where: { email: result.data.email.toLowerCase() } });
  if (existing) {
    return {
      success: false,
      error: 'Email already registered'
    };
  }

  await prisma.user.create({
    data: {
      email: result.data.email.toLowerCase(),
      name: result.data.name,
      passwordHash: await hash(result.data.password, 10)
    }
  });

  return { success: true };
}
