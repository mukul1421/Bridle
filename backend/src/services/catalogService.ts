export interface CatalogItem {
  id: string;
  vendorId: string;
  vendorName: string;
  category: 'snacks' | 'office_supplies' | 'cloud_infrastructure';
  name: string;
  unitPrice: number;
  currency: string;
  inStock: boolean;
  tags: string[];
}

const INITIAL_CATALOG_DATABASE: CatalogItem[] = [
  // Snacks Category (Vendor: Snack House Pvt Ltd - Allowlisted)
  {
    id: 'item_snack_01',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    name: 'Assorted Snack Box (Deluxe)',
    unitPrice: 1000,
    currency: 'INR',
    inStock: true,
    tags: ['snack', 'snacks', 'food', 'refreshment', 'box', 'office snacks'],
  },
  {
    id: 'item_snack_02',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    name: 'Beverage Crate (24 Cans)',
    unitPrice: 1500,
    currency: 'INR',
    inStock: true,
    tags: ['beverage', 'drinks', 'soda', 'crate', 'snacks', 'coffee'],
  },
  {
    id: 'item_snack_03',
    vendorId: 'snack_house_pvt_ltd',
    vendorName: 'Snack House Pvt Ltd',
    category: 'snacks',
    name: 'Energy Bar Pack (12-pack)',
    unitPrice: 800,
    currency: 'INR',
    inStock: true,
    tags: ['energy bar', 'bars', 'healthy', 'snacks'],
  },

  // Office Supplies Category (Vendor: Office Supplies Co - Allowlisted)
  {
    id: 'item_office_01',
    vendorId: 'office_supplies_co',
    vendorName: 'Office Supplies Co',
    category: 'office_supplies',
    name: 'A4 Paper Reams (5-pack)',
    unitPrice: 1200,
    currency: 'INR',
    inStock: true,
    tags: ['paper', 'a4', 'reams', 'printing', 'office', 'stationery'],
  },
  {
    id: 'item_office_02',
    vendorId: 'office_supplies_co',
    vendorName: 'Office Supplies Co',
    category: 'office_supplies',
    name: 'Executive Gel Pen Set (20-pack)',
    unitPrice: 400,
    currency: 'INR',
    inStock: true,
    tags: ['pen', 'pens', 'ballpoint', 'gel pen', 'writing', 'stationery'],
  },
  {
    id: 'item_office_03',
    vendorId: 'office_supplies_co',
    vendorName: 'Office Supplies Co',
    category: 'office_supplies',
    name: 'Toner Cartridge (High Yield)',
    unitPrice: 4500,
    currency: 'INR',
    inStock: true,
    tags: ['toner', 'cartridge', 'printer', 'printing', 'ink'],
  },
  {
    id: 'item_office_04',
    vendorId: 'office_supplies_co',
    vendorName: 'Office Supplies Co',
    category: 'office_supplies',
    name: 'Ergonomic Mesh Executive Chair',
    unitPrice: 12000,
    currency: 'INR',
    inStock: true,
    tags: ['chair', 'ergonomic', 'furniture', 'desk chair', 'office'],
  },

  // Cloud Infrastructure Category (Vendor: Cloud Services Inc - Allowlisted)
  {
    id: 'item_cloud_01',
    vendorId: 'cloud_services_inc',
    vendorName: 'Cloud Services Inc',
    category: 'cloud_infrastructure',
    name: 'Server Compute Credits (100 CPU Hours)',
    unitPrice: 5000,
    currency: 'INR',
    inStock: true,
    tags: ['cloud', 'server', 'compute', 'hosting', 'cpu', 'infrastructure'],
  },
  {
    id: 'item_cloud_02',
    vendorId: 'cloud_services_inc',
    vendorName: 'Cloud Services Inc',
    category: 'cloud_infrastructure',
    name: 'Managed Database Monthly Subscription',
    unitPrice: 15000,
    currency: 'INR',
    inStock: true,
    tags: ['database', 'managed db', 'postgres', 'cloud', 'infrastructure'],
  },

  // Unapproved Vendor Item (Vendor: Unapproved Tech Store 99 - NOT ALLOWLISTED)
  {
    id: 'item_unapproved_01',
    vendorId: 'unapproved_store_99',
    vendorName: 'Unapproved Tech Store 99',
    category: 'cloud_infrastructure',
    name: 'Refurbished Enterprise Storage Hard Drive',
    unitPrice: 6000,
    currency: 'INR',
    inStock: true,
    tags: ['hard drive', 'storage', 'disk', 'unapproved', 'refurbished'],
  },
];

export let CATALOG_DATABASE: CatalogItem[] = [...INITIAL_CATALOG_DATABASE];

/**
 * Returns all current catalog items
 */
export function getCatalogItems(): CatalogItem[] {
  return [...CATALOG_DATABASE];
}

/**
 * Adds a new item/supplier to the dynamic catalog
 */
export function addCatalogItem(item: Omit<CatalogItem, 'id'> & { id?: string }): CatalogItem {
  const newItem: CatalogItem = {
    id: item.id || `item_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    vendorId: item.vendorId.trim().toLowerCase().replace(/\s+/g, '_'),
    vendorName: item.vendorName.trim(),
    category: item.category,
    name: item.name.trim(),
    unitPrice: Number(item.unitPrice),
    currency: item.currency || 'INR',
    inStock: item.inStock ?? true,
    tags: Array.isArray(item.tags)
      ? item.tags.map((t) => t.trim().toLowerCase())
      : [item.name.toLowerCase(), item.vendorName.toLowerCase()],
  };

  CATALOG_DATABASE.unshift(newItem);
  return newItem;
}

/**
 * Deletes a catalog item by ID
 */
export function deleteCatalogItem(itemId: string): boolean {
  const index = CATALOG_DATABASE.findIndex((item) => item.id === itemId);
  if (index !== -1) {
    CATALOG_DATABASE.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Returns unique suppliers in the catalog
 */
export function getAvailableSuppliers(): Array<{ vendorId: string; vendorName: string; category: string; itemCount: number }> {
  const map = new Map<string, { vendorId: string; vendorName: string; category: string; itemCount: number }>();

  for (const item of CATALOG_DATABASE) {
    if (!map.has(item.vendorId)) {
      map.set(item.vendorId, {
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        category: item.category,
        itemCount: 0,
      });
    }
    const current = map.get(item.vendorId)!;
    current.itemCount += 1;
  }

  return Array.from(map.values());
}

/**
 * Resets catalog back to original baseline
 */
export function resetCatalogToDefault(): void {
  CATALOG_DATABASE = [...INITIAL_CATALOG_DATABASE];
}

/**
 * Searches vendor catalog by keyword and category
 */
export function searchCatalog(query: string, categoryFilter?: string): CatalogItem[] {
  const normalizedQuery = query.toLowerCase();

  return CATALOG_DATABASE.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) {
      return false;
    }

    const matchesName = item.name.toLowerCase().includes(normalizedQuery);
    const matchesTag = item.tags.some((tag) => normalizedQuery.includes(tag) || tag.includes(normalizedQuery));
    const matchesVendor = item.vendorName.toLowerCase().includes(normalizedQuery) || item.vendorId.includes(normalizedQuery);

    return matchesName || matchesTag || matchesVendor;
  });
}

/**
 * Gets item by ID
 */
export function getCatalogItemById(itemId: string): CatalogItem | undefined {
  return CATALOG_DATABASE.find((item) => item.id === itemId);
}
