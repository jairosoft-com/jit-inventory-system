import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SupplierInput {
  supplierName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  deletedAt: Date | null;
}

const qaSuppliers: SupplierInput[] = [
  {
    supplierName: 'QA Active Supplier Alpha 206417',
    contactPerson: 'Alpha Contact',
    email: 'alpha206417@example.com',
    phone: '09170000001',
    address: 'Davao City',
    deletedAt: null,
  },
  {
    supplierName: 'QA Active Supplier Beta 206417',
    contactPerson: 'Beta Contact',
    email: 'beta206417@example.com',
    phone: '09170000002',
    address: 'Davao City',
    deletedAt: null,
  },
  {
    supplierName: 'QA Inactive Supplier Gamma 206417',
    contactPerson: 'Gamma Contact',
    email: 'gamma206417@example.com',
    phone: '09170000003',
    address: 'Davao City',
    deletedAt: new Date(),
  },
];

async function upsertSupplier(supplierData: SupplierInput) {
  const existingSupplier = await prisma.supplier.findFirst({
    where: {
      supplierName: supplierData.supplierName,
    },
  });

  if (existingSupplier) {
    const updatedSupplier = await prisma.supplier.update({
      where: {
        id: existingSupplier.id,
      },
      data: supplierData as Prisma.SupplierUpdateInput,
    });

    console.log(`Updated supplier: ${updatedSupplier.supplierName}`);
    return;
  }

  const createdSupplier = await prisma.supplier.create({
    data: supplierData as Prisma.SupplierCreateInput,
  });

  console.log(`Created supplier: ${createdSupplier.supplierName}`);
}

async function main() {
  console.log('Seeding QA suppliers for Ticket 206417...');

  for (const supplierData of qaSuppliers) {
    await upsertSupplier(supplierData);
  }

  console.log('QA supplier seed complete.');
  console.log('');
  console.log('Expected QA data:');
  console.log('- Active filter: Alpha and Beta');
  console.log('- Inactive filter: Gamma');
  console.log('- All filter: Alpha, Beta, and Gamma');
  console.log('- Search Alpha/Beta/Gamma to verify name filtering');
}

main()
  .catch((error) => {
    console.error('Failed to seed QA suppliers.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
