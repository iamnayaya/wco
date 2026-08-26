/** Single import surface for products-module services (keeps controller headers tidy). */

export { categoryV2Service, productTagCatalogService } from './catalog.service.js';
export { productVariantService } from './variants.service.js';
export { productImageService } from './images.service.js';
export { productDiscountService } from './discounts.service.js';
export { productInventoryService } from './inventory.service.js';
export { productImportExportService } from './import-export.service.js';
export {
  productEnrichmentService,
  whatsAppCatalogSyncService,
} from './enrichment.service.js';
