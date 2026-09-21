export interface TemplateDefinition {
  type: string;
  name: string;
  bankName: string;
  productName: string;
  description: string;
  badge: string;
  headers: string[];
  sampleRow: any[];
}

export const PREBUILT_TEMPLATES: Record<string, TemplateDefinition> = {
  'one_bank_cc': {
    type: 'one_bank_cc',
    name: 'One Bank Credit Card',
    bankName: 'One Bank Limited',
    productName: 'Credit Card',
    description: 'Standard credit card recovery format with card number, minimum due, and present/permanent address.',
    badge: 'Credit Card',
    headers: [
      'FILE_NO', 'CARD_NO', 'CUSTOMER_NAME', 'MOBILE_NO', 'PHONE_OFFICE',
      'PRESENT_ADDRESS', 'PERMANENT_ADDRESS', 'TOTAL_OUTSTANDING', 'MINIMUM_DUE',
      'TOTAL_LIMIT', 'BUCKET', 'ALLOCATION_DATE', 'EXPIRY_DATE', 'AGENT_NAME', 'LEGAL_STATUS'
    ],
    sampleRow: [
      'ONE-CC-2024-00101', '4521098877665544', 'Md. Kamal Uddin', '01711-123456', '02-9887766',
      'House 12, Road 4, Banani, Dhaka', 'Vill: Alinagar, P.O. Sadar, Comilla',
      75000, 15000, 100000, 'B3', '2026-08-01', '2026-10-31', 'Tariqul Islam', 'Standard Notice Sent'
    ]
  },
  'one_bank_loan': {
    type: 'one_bank_loan',
    name: 'One Bank Personal & SME Loan',
    bankName: 'One Bank Limited',
    productName: 'Personal Loan',
    description: 'Loan account recovery schema with account number, sanction amount, and EMI breakdown.',
    badge: 'Personal Loan',
    headers: [
      'FILE_NO', 'ACCOUNT_NO', 'BORROWER_NAME', 'MOBILE_NO', 'OFFICE_PHONE',
      'PRESENT_ADDRESS', 'PERMANENT_ADDRESS', 'SANCTION_AMOUNT', 'OUTSTANDING_AMOUNT',
      'OVERDUE_AMOUNT', 'EMI_AMOUNT', 'DPD_DAYS', 'ALLOCATION_DATE', 'EXPIRY_DATE', 'AGENT_NAME'
    ],
    sampleRow: [
      'ONE-PL-2024-00201', 'PL202400998877', 'Shahabuddin Chowdhury', '01812-654321', '02-8877665',
      'Plot 45, Sector 7, Uttara, Dhaka', 'Vill: Monoharpur, Narail',
      500000, 245000, 48000, 16000, 90, '2026-07-15', '2026-10-15', 'Tariqul Islam'
    ]
  },
  'dbbl_cc': {
    type: 'dbbl_cc',
    name: 'Dutch-Bangla Bank NEXUS Cards',
    bankName: 'Dutch-Bangla Bank Limited',
    productName: 'NEXUS Credit Card',
    description: 'DBBL card recovery template with masked card, mother name, and overdue breakdown.',
    badge: 'NEXUS Card',
    headers: [
      'FILE_NO', 'CARD_NUMBER', 'CLIENT_NAME', 'FATHER_NAME', 'MOTHER_NAME',
      'CONTACT_NO_1', 'CONTACT_NO_2', 'PRESENT_ADDRESS', 'PERMANENT_ADDRESS',
      'TOTAL_OS', 'OVERDUE_AMOUNT', 'MIN_DUE', 'DPD', 'ALLOCATION_DATE', 'EXPIRY_DATE', 'AGENT_NAME'
    ],
    sampleRow: [
      'DBBL-CC-2024-00301', '5534109988776655', 'Nasrin Akter', 'Abdul Gafur', 'Rokeya Begum',
      '01912-334455', '01612-998877', 'Flat 3B, Agrabad C/A, Chittagong', 'Vill: Rangunia, Chittagong',
      62000, 18500, 6000, 60, '2026-08-01', '2026-09-30', 'Tariqul Islam'
    ]
  },
  'dbbl_agent_banking': {
    type: 'dbbl_agent_banking',
    name: 'DBBL Agent Banking Recovery',
    bankName: 'Dutch-Bangla Bank Limited',
    productName: 'Agent Banking Loan',
    description: 'Agent banking rural and union-level loan recovery format with outlet details.',
    badge: 'Agent Banking',
    headers: [
      'FILE_NO', 'ACCOUNT_NUMBER', 'CUSTOMER_NAME', 'AGENT_OUTLET_NAME', 'DISTRICT',
      'MOBILE_NO', 'PRESENT_ADDRESS', 'PERMANENT_ADDRESS', 'PRINCIPAL_OUTSTANDING',
      'INTEREST_OVERDUE', 'TOTAL_DUE', 'DISBURSEMENT_DATE', 'EXPIRY_DATE', 'AGENT_NAME'
    ],
    sampleRow: [
      'DBBL-ABL-2024-00401', 'ABL2024005544', 'Nurul Absar Miah', 'Hathazari Outlet', 'Chittagong',
      '01618-700100', 'Halishahar, Chittagong', 'Vill: Sikalbaha, Chandanaish, Chittagong',
      120000, 25000, 145000, '2025-06-10', '2026-09-10', 'Tariqul Islam'
    ]
  },
  'asian_paints': {
    type: 'asian_paints',
    name: 'Asian Paints Dealer Recovery',
    bankName: 'Asian Paints Bangladesh',
    productName: 'Dealer Recovery',
    description: 'Corporate B2B dealer credit overdue schedule with territory & shop name.',
    badge: 'Dealer Ledger',
    headers: [
      'FILE_NO', 'DEALER_CODE', 'SHOP_NAME', 'PROPRIETOR_NAME', 'PHONE_NUMBER',
      'SHOP_ADDRESS', 'WAREHOUSE_ADDRESS', 'CREDIT_LIMIT', 'TOTAL_OUTSTANDING',
      'OVERDUE_90_PLUS', 'TERRITORY', 'ALLOCATION_DATE', 'EXPIRY_DATE', 'AGENT_NAME'
    ],
    sampleRow: [
      'APB-DR-2024-00501', 'DR-8899', 'Mahmud Hardware & Paints', 'Mr. Mahmudul Hasan', '01912-800200',
      '12 Kawran Bazar, Dhaka', 'Demra Road, Narayanganj', 500000, 320000, 130000, 'Dhaka Central',
      '2026-07-01', '2026-10-01', 'Tariqul Islam'
    ]
  }
};
