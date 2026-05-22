import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { ItemType } from '@prisma/client';

describe('Categories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await prisma.category.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/categories', () => {
    it('should create a category', () => {
      return request(app.getHttpServer())
        .post('/api/categories')
        .send({
          name: 'Test Equipment',
          type: ItemType.EQUIPMENT,
          description: 'Test description',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Equipment');
          expect(res.body.type).toBe(ItemType.EQUIPMENT);
          expect(res.body.deletedAt).toBeNull();
        });
    });

    it('should return 409 for duplicate name (including archived)', async () => {
        await prisma.category.create({
          data: {
            name: 'Archived Category',
            type: ItemType.EQUIPMENT,
            deletedAt: new Date(),
          },
        });
      
        return request(app.getHttpServer())
          .post('/api/categories')
          .send({
            name: 'Archived Category',
            type: ItemType.CONSUMABLE,
          })
          .expect(409);
      });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/categories')
        .send({
          name: 'Missing Type',
        })
        .expect(400);
    });

    it('should return 400 for invalid ItemType', () => {
      return request(app.getHttpServer())
        .post('/api/categories')
        .send({
          name: 'Invalid Type',
          type: 'INVALID_TYPE',
        })
        .expect(400);
    });
  });

  describe('GET /api/categories', () => {
    beforeEach(async () => {
      await prisma.category.deleteMany();
    });

    it('should return all non-deleted categories', async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Category 1', type: ItemType.EQUIPMENT },
          { name: 'Category 2', type: ItemType.CONSUMABLE },
        ],
      });

      return request(app.getHttpServer())
        .get('/api/categories')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          expect(res.body[0].name).toBe('Category 1');
        });
    });

    it('should exclude soft-deleted categories', async () => {
      await prisma.category.create({
        data: {
          name: 'Active',
          type: ItemType.EQUIPMENT,
        },
      });

      await prisma.category.create({
        data: {
          name: 'Deleted',
          type: ItemType.EQUIPMENT,
          deletedAt: new Date(),
        },
      });

      return request(app.getHttpServer())
        .get('/api/categories')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].name).toBe('Active');
        });
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a category by id', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Test Category',
          type: ItemType.EQUIPMENT,
        },
      });

      return request(app.getHttpServer())
        .get(`/api/categories/${category.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(category.id);
          expect(res.body.name).toBe('Test Category');
        });
    });

    it('should return 404 for non-existent category', () => {
      return request(app.getHttpServer())
        .get('/api/categories/9999')
        .expect(404);
    });

    it('should return 404 for soft-deleted category', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Deleted Category',
          type: ItemType.EQUIPMENT,
          deletedAt: new Date(),
        },
      });

      return request(app.getHttpServer())
        .get(`/api/categories/${category.id}`)
        .expect(404);
    });
  });

  describe('PATCH /api/categories/:id', () => {
    it('should update a category', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Original Name',
          type: ItemType.EQUIPMENT,
        },
      });

      return request(app.getHttpServer())
        .patch(`/api/categories/${category.id}`)
        .send({
          name: 'Updated Name',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
        });
    });

    it('should return 409 when updating to existing name', async () => {
      const cat1 = await prisma.category.create({
        data: { name: 'Category 1', type: ItemType.EQUIPMENT },
      });

      const cat2 = await prisma.category.create({
        data: { name: 'Category 2', type: ItemType.CONSUMABLE },
      });

      return request(app.getHttpServer())
        .patch(`/api/categories/${cat2.id}`)
        .send({ name: 'Category 1' })
        .expect(409);
    });

    it('should return 404 for non-existent category', () => {
      return request(app.getHttpServer())
        .patch('/api/categories/9999')
        .send({ name: 'New Name' })
        .expect(404);
    });
  });

  describe('DELETE /api/categories/:id (soft delete)', () => {
    it('should archive a category', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'To Archive',
          type: ItemType.EQUIPMENT,
        },
      });

      return request(app.getHttpServer())
        .delete(`/api/categories/${category.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.deletedAt).not.toBeNull();
        });
    });

    it('should return 404 for non-existent category', () => {
      return request(app.getHttpServer())
        .delete('/api/categories/9999')
        .expect(404);
    });

    it('archived category should not appear in findAll', async () => {
      const category = await prisma.category.create({
        data: {
          name: 'Archive Test',
          type: ItemType.EQUIPMENT,
        },
      });

      await request(app.getHttpServer())
        .delete(`/api/categories/${category.id}`)
        .expect(200);

      return request(app.getHttpServer())
        .get('/api/categories')
        .expect(200)
        .expect((res) => {
          expect(res.body.find((c: any) => c.id === category.id)).toBeUndefined();
        });
    });
  });
});