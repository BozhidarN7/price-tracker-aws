import { CURRENCIES_SYMBOLS_MAP, TRENDS } from '../constants/index.ts';

export type PriceEntry = {
  priceEntryId: string;
  date: string;
  store?: string;
  location?: {
    lat: number;
    lng: number;
  };
  price: number;
  currency: keyof typeof CURRENCIES_SYMBOLS_MAP;
};

export type Product = {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  imageUrl?: string;

  // Price tracking
  latestPrice: number;
  latestCurrency: keyof typeof CURRENCIES_SYMBOLS_MAP;
  priceHistory: PriceEntry[];

  // Analytics (computed fields)
  averagePrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  trend?: TRENDS;

  // Metadata
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  ocrRawText?: string; // Raw OCR output for debugging
};

export type AIProduct = {
  name: string;
  price: number;
  brand: string | null;
};

export type AIResult = {
  store: string | null;
  currency: keyof typeof CURRENCIES_SYMBOLS_MAP;
  purchaseDate: string;
  products: AIProduct[];
};
