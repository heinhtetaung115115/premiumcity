import { prisma } from './prisma';

export function getActiveCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    where: {
      products: {
        some: { status: 'ACTIVE' }
      }
    },
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
}

export function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: 'ACTIVE' },
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { position: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  });
}

export function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { position: 'asc' }
      }
    }
  });
}
