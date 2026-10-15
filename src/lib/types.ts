export interface PriceTier {
  qty_range: string;
  price: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  slug: string;
  category: string;
  short_description: string;
  full_description: string;
  image_url: string;
  gallery?: { url: string; title: string; alt?: string }[];
  moq: number; // In thousand pieces (e.g. 5,000 or 10,000 pads) or cartons
  lead_time: string;
  gsm_range: string; // Absorbency / GSM / Capacity (e.g. 40ml - 120ml / pad)
  fabric_options: string[]; // Core & Film Materials (e.g. Food Grade PE, SAP, Virgin Cellulose)
  sizes: string[]; // Dimensions (e.g. 80x140mm, 100x160mm, 120x180mm)
  colors: string[]; // White, Black, Custom Absorber Color
  price_tiers: PriceTier[];
  specifications: Record<string, string>;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export type InquiryStatus = 'NEW' | 'PENDING' | 'CONTACTED' | 'QUOTED' | 'SAMPLING' | 'CLOSED' | 'CANCELLED';

export interface Inquiry {
  id: string;
  inquiry_no: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  product_slug?: string;
  product_name: string;
  quantity: number;
  target_timeline?: string;
  fabric_choice?: string; // Pad Size / Absorbency choice
  customization_type?: string; // Custom Die-cut, Roll format, Private Label Carton
  message?: string;
  status: InquiryStatus | string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent' | string;
  deadline?: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  status: 'Active' | 'Inactive';
  item_count?: number;
  description?: string;
}

export interface Review {
  id: string;
  date: string;
  reviewer: string;
  company: string;
  rating: number;
  message: string;
  status: 'Approved' | 'Pending' | 'Rejected' | string;
  visibility: 'Hidden' | 'Visible' | string;
}

export interface SiteSettings {
  company_phone: string;
  company_whatsapp: string;
  notification_email: string;
  company_location: string;
  admin_pin: string;
}
