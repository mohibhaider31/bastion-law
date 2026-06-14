import type { Database } from './types';

type Tables = Database['public']['Tables'];

export type Profile      = Tables['profiles']['Row'];
export type Matter       = Tables['matters']['Row'];
export type MatterLawyer = Tables['matter_lawyers']['Row'];
export type Document     = Tables['documents']['Row'];
export type Message      = Tables['messages']['Row'];
export type Event        = Tables['events']['Row'];
export type Appointment  = Tables['appointments']['Row'];
export type Invoice      = Tables['invoices']['Row'];
export type InvoiceItem  = Tables['invoice_items']['Row'];
export type TimeEntry    = Tables['time_entries']['Row'];
export type PrivateNote  = Tables['private_notes']['Row'];
export type AuditLog     = Tables['audit_logs']['Row'];
export type Notification = Tables['notifications']['Row'];

export type UserRole = 'client' | 'lawyer' | 'owner';

// Enriched types with joins
export type MatterWithTeam = Matter & {
  client: Profile;
  lead_lawyer: Profile;
  team: (MatterLawyer & { lawyer: Profile })[];
};

export type MessageWithSender = Message & {
  sender: Profile;
};

export type DocumentWithRequester = Document & {
  requester: Profile | null;
};
