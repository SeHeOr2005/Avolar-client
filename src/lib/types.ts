export type ReservationStatus = 'PENDING_PAYMENT' | 'PAYMENT_REVIEW' | 'CONFIRMED' | 'CANCELLED' | 'FINISHED';

export interface Hours {
  weekday: number;
  isOpen: boolean;
  openMinute: number;
  closeMinute: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountHolder: string | null;
  accountType: string | null;
  details: string | null;
  logoUrl: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface PublicSettings {
  businessName: string;
  tagline: string | null;
  about: string | null;
  whatsappNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  mapsUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  currency: string;
  timezone: string;
  depositPercent: number;
  slotMinutes: number;
  bookingWindowDays: number;
  minLeadMinutes: number;
  paymentHoldMinutes: number;
  reservationsEnabled: boolean;
  lowStockThreshold: number;
  paymentMethods: PaymentMethod[];
  hours: Hours[];
}

export interface Image {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface GameConsole {
  id: string;
  name: string;
  slug: string;
  platform: string;
  description: string | null;
  features: string[];
  pricePerHour: number;
  minMinutes: number;
  maxMinutes: number;
  maxPlayers: number;
  isActive: boolean;
  sortOrder: number;
  customSchedule: boolean;
  images: Image[];
  schedules?: Hours[];
  reservationCount?: number;
}

export interface Availability {
  date: string;
  timezone: string;
  slotMinutes: number;
  minMinutes: number;
  maxMinutes: number;
  pricePerHour: number;
  depositPercent: number;
  currency: string;
  open: number | null;
  close: number | null;
  busy: { start: number; end: number }[];
  earliestStart: number | null;
  reason: string | null;
}

export interface PublicReservation {
  code: string;
  status: ReservationStatus;
  statusLabel: string;
  customerName: string;
  console: { name: string; platform: string };
  dateLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  pricePerHour: number;
  totalAmount: number;
  depositPercent: number;
  depositAmount: number;
  balanceAmount: number;
  currency: string;
  holdExpiresAt: string | null;
  paymentSentAt: string | null;
  createdAt: string;
  paymentInstructions: string | null;
  paymentMethods: PaymentMethod[];
  whatsappNumber: string | null;
  whatsappUrl: string | null;
}

export type Availability_ = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INACTIVE';

export interface Variant {
  id: string;
  size: string;
  color: string | null;
  colorHex: string | null;
  stock: number;
  inStock: boolean;
  sku?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  images: Image[];
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  variants: Variant[];
  totalStock: number;
  availability: Availability_;
  availabilityLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: { id: string; key: string; name: string };
  permissions: string[];
  isSuperadmin: boolean;
}
