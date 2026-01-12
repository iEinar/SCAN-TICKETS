
export type TextAlignment = 'left' | 'center' | 'right';
export type LayoutType = 'single' | 'split'; // 'split' for "Item.....Price" format
export type ElementType = 'text' | 'separator' | 'barcode' | 'logo' | 'qr';
export type FontSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';

export interface ReceiptItem {
  id: string;
  type: ElementType;
  text: string; // The raw text content
  secondaryText?: string; // For split layout (e.g., price on the right)
  layout: LayoutType;
  align: TextAlignment;
  isBold: boolean;
  fontSize: FontSize;
  fontFamily: 'mono' | 'sans';
  marginTop?: number; // visual spacing estimation
  separatorStyle?: 'dashed' | 'solid' | 'double' | 'dotted'; // Only for type='separator'
}

export interface ReceiptMetadata {
  storeName: string;
  date: string; // ISO format YYYY-MM-DD
  totalAmount?: string;
  postalCode?: string; // New field for CP
}

export interface BillingData {
  merchantKey?: string; // 'walmart', 'oxxo', etc.
  ticketNumber?: string; // Folio
  transactionId?: string; // TR in Walmart
  terminalId?: string; // TC in Walmart
  rawTotal?: number;
  captureUrl?: string;
}

export interface TaxProfile {
  rfc: string;
  razonSocial: string;
  cp: string;
  regimenFiscal: string;
  usoCFDI: string;
  email: string;
}

export interface ImageQualityAssessment {
  isReadable: boolean;
  readabilityScore: number; // 0 to 100
  issues: string[]; // e.g., 'blur', 'dark', 'cut-off', 'glare', 'not-a-receipt'
}

export interface ReceiptData {
  items: ReceiptItem[];
  metadata: ReceiptMetadata;
  billing?: BillingData; // Structured data for billing
  quality?: ImageQualityAssessment; // New: AI assessment of image quality
  widthEstimate?: number; // mm
  originalImage?: string; // To keep track of source image
  isReprocessing?: boolean; // UI State for re-cloning
}

export interface AnalysisState {
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  progress?: {
    current: number;
    total: number;
  };
  error?: string;
}
