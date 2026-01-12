
import { ReceiptData } from "../types";

export interface BillingStrategy {
  key: string;
  name: string;
  logo: string;
  portalUrl: string;
  detect: (text: string, storeName: string) => boolean;
  extract: (text: string, metadata: any) => Record<string, string>;
  validate: (data: Record<string, string>) => { valid: boolean; missing: string[] };
}

// --- HELPER: Generic Extraction ---
const genericExtraction = (text: string) => {
    const result: Record<string, string> = { ticketNumber: '' };
    const match = text.match(/(?:Folio|Ticket|Ref|Referencia|Boleto)\s*[:#]?\s*(\w+)/i);
    if (match) {
        result.ticketNumber = match[1];
    }
    return result;
};

// --- STRATEGIES DEFINITIONS ---

const WalmartStrategy: BillingStrategy = {
  key: 'walmart',
  name: 'Walmart México',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Walmart_logo.svg/2560px-Walmart_logo.svg.png',
  portalUrl: 'https://facturacion.walmartmexico.com.mx/',
  detect: (text, storeName) => {
    const n = (text + storeName).toLowerCase();
    return n.includes('walmart') || n.includes('wal-mart') || n.includes('bodega aurrera') || n.includes('superama') || n.includes('sams club');
  },
  extract: (text) => {
    const result: Record<string, string> = {};
    const trMatch = text.match(/TR\s*[:#]?\s*(\d[\d\s]+)/i);
    if (trMatch) result.transactionId = trMatch[1].replace(/\s/g, '');
    const tcMatch = text.match(/TC\s*[:#]?\s*(\d[\d\s]+)/i);
    if (tcMatch) result.ticketNumber = tcMatch[1].replace(/\s/g, '');
    return result;
  },
  validate: (data) => {
    const missing = [];
    if (!data.transactionId) missing.push('TR (Número de Transacción)');
    if (!data.ticketNumber) missing.push('TC (Código de Ticket)');
    return { valid: missing.length === 0, missing };
  }
};

const OxxoStrategy: BillingStrategy = {
    key: 'oxxo',
    name: 'OXXO',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/66/Oxxo_Logo.svg',
    portalUrl: 'https://www4.oxxo.com/facturacion-electronica',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('oxxo'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const SevenElevenStrategy: BillingStrategy = {
    key: '7eleven',
    name: '7-Eleven',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/7-eleven_logo.svg/1200px-7-eleven_logo.svg.png',
    portalUrl: 'http://www.7-eleven.com.mx/facturacion',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('7-eleven') || (text + storeName).toLowerCase().includes('seven eleven'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const CostcoStrategy: BillingStrategy = {
    key: 'costco',
    name: 'Costco Wholesale',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Costco_Wholesale_logo_2010-10-26.svg/2560px-Costco_Wholesale_logo_2010-10-26.svg.png',
    portalUrl: 'https://www3.costco.com.mx/facturacion',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('costco'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const StarbucksStrategy: BillingStrategy = {
    key: 'starbucks',
    name: 'Starbucks',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png',
    portalUrl: 'https://facturas.starbucks.com.mx/',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('starbucks'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const SorianaStrategy: BillingStrategy = {
    key: 'soriana',
    name: 'Soriana',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Soriana_logo.svg/2560px-Soriana_logo.svg.png',
    portalUrl: 'https://facturacion.soriana.com/',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('soriana'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const ChedrauiStrategy: BillingStrategy = {
    key: 'chedraui',
    name: 'Chedraui',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Chedraui_logo_201x.svg/2560px-Chedraui_logo_201x.svg.png',
    portalUrl: 'https://www.chedraui.com.mx/facturacion',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('chedraui'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const LiverpoolStrategy: BillingStrategy = {
    key: 'liverpool',
    name: 'Liverpool',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Liverpool_logo.svg/2560px-Liverpool_logo.svg.png',
    portalUrl: 'https://facturacion.liverpool.com.mx/',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('liverpool'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const FarmaciasGuadalajaraStrategy: BillingStrategy = {
    key: 'farmacias_guadalajara',
    name: 'Farmacias Guadalajara',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Farmacias_Guadalajara_logo.svg',
    portalUrl: 'https://www.farmaciasguadalajara.com/facturacion-electronica',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('farmacias guadalajara') || (text + storeName).toLowerCase().includes('fragua'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const CinemexStrategy: BillingStrategy = {
    key: 'cinemex',
    name: 'Cinemex',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Cinemex_logo.png',
    portalUrl: 'https://webportal.edicomgroup.com/customers/cinemex/search.htm',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('cinemex'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const CarlsJrStrategy: BillingStrategy = {
    key: 'carlsjr',
    name: "Carl's Jr.",
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Carl%27s_Jr._logo.svg/1024px-Carl%27s_Jr._logo.svg.png',
    portalUrl: 'https://dath.libellum.com.mx/',
    detect: (text, storeName) => {
        const t = (text + storeName).toLowerCase();
        return t.includes("carl's jr") || t.includes("carls jr") || t.includes("carlsjr");
    },
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const LecarozStrategy: BillingStrategy = {
    key: 'lecaroz',
    name: "Panadería Lecaroz",
    logo: 'https://lecaroz.com/wp-content/themes/lecaroz/assets/img/logo-lecaroz.png',
    portalUrl: 'http://lecaroz.homedns.org:4575/facturacion/',
    detect: (text, storeName) => (text + storeName).toLowerCase().includes('lecaroz'),
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const TresBStrategy: BillingStrategy = {
    key: 'tresb',
    name: 'Tiendas 3B',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Tiendas_3B_logo.svg/1200px-Tiendas_3B_logo.svg.png',
    portalUrl: 'https://clientes.3bfactura.com/',
    detect: (text, storeName) => {
        const t = (text + storeName).toLowerCase();
        return t.includes('tiendas 3b') || t.includes('3b') || t.includes('tres b');
    },
    extract: genericExtraction,
    validate: (data) => ({ valid: !!data.ticketNumber, missing: [] })
};

const GenericStrategy: BillingStrategy = {
  key: 'generic',
  name: 'Facturación Genérica',
  logo: '',
  portalUrl: '',
  detect: () => true,
  extract: () => ({}),
  validate: () => ({ valid: true, missing: [] })
};

// --- REGISTRY ---
const strategies = [
    WalmartStrategy, 
    OxxoStrategy,
    SevenElevenStrategy,
    CostcoStrategy,
    StarbucksStrategy,
    SorianaStrategy,
    ChedrauiStrategy,
    LiverpoolStrategy,
    FarmaciasGuadalajaraStrategy,
    CinemexStrategy, 
    CarlsJrStrategy, 
    LecarozStrategy,
    TresBStrategy
];

export const identifyMerchant = (receipt: ReceiptData): BillingStrategy => {
  const fullText = receipt.items.map(i => i.text).join(' ');
  const match = strategies.find(s => s.detect(fullText, receipt.metadata.storeName));
  return match || GenericStrategy;
};

export const getStrategyByKey = (key: string): BillingStrategy => {
    return strategies.find(s => s.key === key) || GenericStrategy;
};
