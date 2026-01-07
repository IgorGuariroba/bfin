import api from './api';
import type { AccountMember } from '../types/transaction';

interface ListMembersResponse {
  original_owner_id: string;
  members: AccountMember[];
}

interface CreateInvitationDTO {
  email: string;
  role: 'owner' | 'member' | 'viewer';
}

interface UpdateMemberRoleDTO {
  role: 'owner' | 'member' | 'viewer';
}

interface Invitation {
  id: string;
  account_id: string;
  invited_email: string;
  invited_by: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  account?: {
    id: string;
    account_name: string;
  };
  inviter: {
    id: string;
    email: string;
    full_name: string;
  };
}

export const accountMemberService = {
  // Lista membros de uma conta
  async listMembers(accountId: string): Promise<ListMembersResponse> {
    const response = await api.get<ListMembersResponse>(`/accounts/${accountId}/members`);
    return response.data;
  },

  // Cria um convite para adicionar membro à conta
  async createInvitation(accountId: string, data: CreateInvitationDTO): Promise<Invitation> {
    const response = await api.post<Invitation>(`/accounts/${accountId}/invitations`, data);
    return response.data;
  },

  // Lista convites de uma conta
  async listInvitations(accountId: string): Promise<Invitation[]> {
    const response = await api.get<Invitation[]>(`/accounts/${accountId}/invitations`);
    return response.data;
  },

  // Lista convites recebidos pelo usuário logado
  async listMyInvitations(): Promise<Invitation[]> {
    const response = await api.get<Invitation[]>('/invitations/my-invitations');
    return response.data;
  },

  // Aceita um convite
  async acceptInvitation(token: string): Promise<AccountMember> {
    const response = await api.post<AccountMember>(`/invitations/${token}/accept`);
    return response.data;
  },

  // Rejeita um convite
  async rejectInvitation(token: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/invitations/${token}/reject`);
    return response.data;
  },

  // Atualiza o role de um membro
  async updateMemberRole(accountId: string, userId: string, data: UpdateMemberRoleDTO): Promise<AccountMember> {
    const response = await api.put<AccountMember>(`/accounts/${accountId}/members/${userId}`, data);
    return response.data;
  },

  // Remove um membro da conta
  async removeMember(accountId: string, userId: string): Promise<void> {
    await api.delete(`/accounts/${accountId}/members/${userId}`);
  },
};
