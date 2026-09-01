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

export const CATALOG_DATABASE: CatalogItem[] = [
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

  // Office Supplies Category (Vendor: Office Supplies Co & Fresh Stationery - Allowlisted)
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
    const matchesVendor = item.vendorName.toLowerCase().includes(normalizedQuery);

    return matchesName || matchesTag || matchesVendor;
  });
}

/**
 * Gets item by ID
 */
export function getCatalogItemById(itemId: string): CatalogItem | undefined {
  return CATALOG_DATABASE.find((item) => item.id === itemId);
}
