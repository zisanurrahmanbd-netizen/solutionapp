export type UserRole = 'admin' | 'manager' | 'cs' | 'agent';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  employee_id?: string;
  role: UserRole;
  manager_id?: number | null;
  manager_name?: string;
  status: 'active' | 'inactive';
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_ping_at?: string | null;
  is_online?: boolean;
  password?: string; // stored locally for auth — never synced to any remote
}

export interface Bank {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Product {
  id: number;
  bank_id: number;
  name: string;
  code: string;
  commission_rate: number;
  bank?: Bank;
}

export type CaseStatus = 
  | 'new' 
  | 'in_progress' 
  | 'visited' 
  | 'broken_promise' 
  | 'disputed' 
  | 'legal' 
  | 'untraceable' 
  | 'settled' 
  | 'closed';

export interface CaseFile {
  id: number;
  file_number: string;
  bank_id: number;
  product_id: number;
  account_number?: string;
  customer_name: string;
  customer_phone?: string;
  customer_secondary_phone?: string;
  customer_address_present?: string;
  customer_address_permanent?: string;
  present_address_visited: boolean;
  permanent_address_visited: boolean;
  outstanding_amount: number;
  overdue_amount: number;
  minimum_payment?: number | null;
  status: CaseStatus;
  legal_status?: string | null;
  availability_status?: string | null;
  assigned_agent_id?: number | null;
  agent_name?: string;
  collector_name?: string;
  assigned_manager_id?: number | null;
  allocation_date?: string | null;
  expiry_date?: string | null;
  last_visit_at?: string | null;
  total_collected_amount: number;
  extra_attributes?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  // Denormalized sheet columns (stored flat for easy access)
  bank_name?: string;
  product_name?: string;
  branch_name?: string;
  area?: string;
  lap_status?: string;
  
  // Relations
  bank?: Bank;
  product?: Product;
  agent?: User;
  manager?: User;
}

export interface CheckIn {
  id: number;
  case_file_id: number;
  agent_id: number;
  address_type: 'present' | 'permanent' | 'other';
  latitude: number;
  longitude: number;
  accuracy?: number;
  notes?: string;
  photo_url?: string;
  visited_at: string;
  agent?: User;
  case_file?: CaseFile;
}

export interface Collection {
  id: number;
  case_file_id: number;
  agent_id: number;
  amount: number;
  payment_method: 'cash' | 'cheque' | 'bank_deposit' | 'online';
  receipt_number?: string;
  notes?: string;
  photo_url?: string;
  collected_at: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  verified_at?: string;
  verified_by?: string;
  agent?: User;
  case_file?: CaseFile;
}

export interface CaseRemark {
  id: number;
  case_file_id: number;
  user_id: number;
  contact_status: 'contacted' | 'uncontacted' | 'door_locked' | 'shifted' | 'refused';
  promised_amount?: number | null;
  promise_date?: string | null;
  remarks: string;
  photo_url?: string;
  created_at: string;
  user?: User;
}

export interface BankContact {
  id: number;
  bank_id: number;
  name: string;
  designation: string;
  department: string;
  phone: string;
  email: string;
  branch: string;
  notes?: string;
  created_at?: string;
  bank?: Bank;
  /** Denormalized bank name stored with the contact so the card/filter always
   *  shows the real bank name even if the bank registry is missing on this
   *  device (fixes the "BANK #96431" fallback badge). */
  bank_name?: string;
}

export interface ImportJob {
  id: number;
  file_name: string;
  sheet_name: string;
  total_rows: number;
  imported_rows: number;
  updated_rows: number;
  failed_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors?: any[];
  created_at: string;
}