export type Participant = {
  id: string;
  name: string;
  position: number;
  claimed: boolean;
  paidCents: number;
  shareCents: number;
  balanceCents: number;
};

export type Expense = {
  id: string;
  payerId: string;
  amountCents: number;
  description: string | null;
  createdAt: string;
  eligibleParticipantIds: string[];
  participantIds: string[];
  hasProof: boolean;
};

export type Transfer = {
  fromId: string;
  toId: string;
  amountCents: number;
};

export type RoomView = {
  id: string;
  name: string;
  totalCents: number;
  updatedAt: string;
  viewerParticipantId: string | null;
  participants: Participant[];
  expenses: Expense[];
  transfers: Transfer[];
};

export type MemberSession = {
  participantId: string;
  memberToken: string;
  recoveryCode?: string;
};
