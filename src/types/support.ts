export type TicketStatus = 'open' | 'pending' | 'resolved';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  school_id: string;
  school_name: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  creator_uid: string;
  creator_role: string;
}

export interface TicketMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'support';
  text: string;
  attachment_url?: string;
  timestamp: string;
}
