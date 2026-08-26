import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';
import type { CreateStoreDto } from './dto/create-store.dto';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,48}$/;

/**
 * StoresService — multi-store management (core differentiator: one trader,
 * several WhatsApp lines/businesses). WhatsApp number connection validates
 * E.164 and enforces global uniqueness — a number can only serve one store.
 */
@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const { merchantId } = TenantContext.require();
    return this.prisma.store.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, slug: true, whatsappNumber: true,
        currency: true, status: true, createdAt: true,
        _count: { select: { products: true, orders: true, customers: true } },
      },
    });
  }

  async create(dto: CreateStoreDto) {
    const { merchantId } = TenantContext.require();
    if (!SLUG_RE.test(dto.slug)) {
      throw new BadRequestException('Slug must be lowercase letters, digits and dashes');
    }
    if (dto.whatsappNumber && !/^\+[1-9]\d{7,14}$/.test(dto.whatsappNumber)) {
      throw new BadRequestException('WhatsApp number must be E.164 format');
    }

    const slugTaken = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
    if (slugTaken) throw new ConflictException('Store URL is already taken');

    return this.prisma.store.create({
      data: {
        merchantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        whatsappNumber: dto.whatsappNumber ?? null,
        currency: dto.currency ?? 'NGN',
        timezone: dto.timezone ?? 'Africa/Lagos',
        country: dto.country ?? 'NG',
      },
      select: { id: true, name: true, slug: true, currency: true },
    });
  }

  async connectWhatsapp(storeId: string, whatsappNumber: string, whatsappNameId?: string) {
    const { storeId: activeStore } = TenantContext.require();
    if (activeStore !== storeId) throw new NotFoundException('Store not found');
    if (!/^\+[1-9]\d{7,14}$/.test(whatsappNumber)) {
      throw new BadRequestException('WhatsApp number must be E.164 format');
    }

    // Global uniqueness of a WhatsApp line across the whole platform
    const taken = await this.prisma.store.findFirst({
      where: { whatsappNumber, id: { not: storeId } },
      select: { id: true },
    });
    if (taken) throw new ConflictException('This WhatsApp number is already connected to another store');

    try {
      return await this.prisma.store.update({
        where: { id: storeId },
        data: { whatsappNumber, ...(whatsappNameId ? { whatsappNameId } : {}) },
        select: { id: true, whatsappNumber: true, status: true },
      });
    } catch {
      throw new NotFoundException('Store not found');
    }
  }

  async get(storeId: string) {
    const found = await this.prisma.store.findFirst({
      where: { id: storeId },
      include: {
        _count: { select: { products: true, orders: true, customers: true, conversations: true } },
      },
    });
    if (!found) throw new NotFoundException('Store not found');
    return found;
  }

  /** Resolve the active store for the tenant header — used by TenantGuard. */
  async resolveMembership(merchantId: string, storeId: string): Promise<boolean> {
    const found = await this.prisma.store.findFirst({
      where: { id: storeId, merchantId },
      select: { id: true },
    });
    return found !== null;
  }
}
