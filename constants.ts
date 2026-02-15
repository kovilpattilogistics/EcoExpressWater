import { ProductType, ProductDefinition } from './types';

export const PRODUCT_CONFIG: Record<ProductType, ProductDefinition> = {
  [ProductType.BOTTLE_300ML]: {
    type: ProductType.BOTTLE_300ML,
    itemsPerCase: 35,
    retailPrice: 150, // Per case usually, but prompt implies unit pricing logic structure. Assuming prompt means price per case for simplicity or unit. Based on text "50 cans for cans & 50 Case for bottles", let's assume bottles are sold by case in backend logic mostly.
    // However, prompt list prices: "300ml - 150". Since 35 bottles * unit price would be high, 150 is likely PER CASE price.
    normalPrice: 160,
    costPrice: 130, // Buying price per case
  },
  [ProductType.BOTTLE_500ML]: {
    type: ProductType.BOTTLE_500ML,
    itemsPerCase: 24,
    retailPrice: 160,
    normalPrice: 180,
    costPrice: 110,
  },
  [ProductType.BOTTLE_1L]: {
    type: ProductType.BOTTLE_1L,
    itemsPerCase: 12,
    retailPrice: 100,
    normalPrice: 110,
    costPrice: 85,
  },
  [ProductType.BOTTLE_2L]: {
    type: ProductType.BOTTLE_2L,
    itemsPerCase: 9,
    retailPrice: 120,
    normalPrice: 130,
    costPrice: 110,
  },
  [ProductType.CAN_20L]: {
    type: ProductType.CAN_20L,
    itemsPerCase: 1, // It's a unit
    retailPrice: 25,
    normalPrice: 30,
    costPrice: 145, // Cost of NEW can
    refillCost: 11, // Cost to refill
  },
};

export const ADMIN_CREDENTIALS = {
  username: 'sirangvjomon@gmail.com',
  password: 'sirangvjomon@gmai.com' // As per prompt (typo included intentionally to match prompt requirements)
};

export const DRIVER_CREDENTIALS = {
  username: 'arun@fleet.com',
  password: 'Arun@123'
};

export const LOW_STOCK_THRESHOLD_CANS = 35;
export const LOW_STOCK_THRESHOLD_BOTTLES = 5; // Cases

export const BASE_PATH = '/water-delivery';