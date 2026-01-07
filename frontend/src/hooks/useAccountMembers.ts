import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountMemberService } from '../services/accountMemberService';

export function useAccountMembers(accountId: string) {
  return useQuery({
    queryKey: ['account-members', accountId],
    queryFn: () => accountMemberService.listMembers(accountId),
    enabled: !!accountId,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      data,
    }: {
      accountId: string;
      data: { email: string; role: 'owner' | 'member' | 'viewer' };
    }) => accountMemberService.createInvitation(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-invitations', variables.accountId] });
    },
  });
}

export function useAccountInvitations(accountId: string) {
  return useQuery({
    queryKey: ['account-invitations', accountId],
    queryFn: () => accountMemberService.listInvitations(accountId),
    enabled: !!accountId,
  });
}

export function useMyInvitations() {
  return useQuery({
    queryKey: ['my-invitations'],
    queryFn: () => accountMemberService.listMyInvitations(),
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => accountMemberService.acceptInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
    },
  });
}

export function useRejectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => accountMemberService.rejectInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      userId,
      role,
    }: {
      accountId: string;
      userId: string;
      role: 'owner' | 'member' | 'viewer';
    }) => accountMemberService.updateMemberRole(accountId, userId, { role }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-members', variables.accountId] });
    },
  });
}

export function useRemoveAccountMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId: string }) =>
      accountMemberService.removeMember(accountId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-members', variables.accountId] });
    },
  });
}

// Backwards compatibility - alias for old hook name
export const useAddAccountMember = useCreateInvitation;
