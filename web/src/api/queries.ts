import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettings, ChatDetail } from '@tavern/shared';
import { api, type CharacterInput, type ProfileInput } from './index';

export const keys = {
  me: ['me'] as const,
  characters: ['characters'] as const,
  character: (id: number) => ['characters', id] as const,
  chats: ['chats'] as const,
  chat: (id: number) => ['chats', id] as const,
  settings: ['settings'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.me(), staleTime: 60_000 });
export const useCharacters = () => useQuery({ queryKey: keys.characters, queryFn: () => api.listCharacters() });
export const useCharacter = (id: number | null) =>
  useQuery({ queryKey: keys.character(id ?? 0), queryFn: () => api.getCharacter(id!), enabled: id !== null });
export const useChats = () => useQuery({ queryKey: keys.chats, queryFn: () => api.listChats() });
export const useChat = (id: number) => useQuery({ queryKey: keys.chat(id), queryFn: () => api.getChat(id) });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.login(password),
    onSuccess: () => qc.setQueryData(keys.me, { authenticated: true }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.me, { authenticated: false });
    },
  });
}

export function useSaveCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: CharacterInput }) =>
      id === null ? api.createCharacter(input) : api.updateCharacter(id, input),
    onSuccess: (detail) => {
      qc.setQueryData(keys.character(detail.id), detail);
      void qc.invalidateQueries({ queryKey: keys.characters, exact: true });
      void qc.invalidateQueries({ queryKey: keys.chats });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCharacter(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.characters });
      void qc.invalidateQueries({ queryKey: keys.chats });
    },
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterId: number) => api.createChat(characterId),
    onSuccess: (chat: ChatDetail) => {
      qc.setQueryData(keys.chat(chat.id), chat);
      void qc.invalidateQueries({ queryKey: keys.chats, exact: true });
    },
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteChat(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.chat(id) });
      void qc.invalidateQueries({ queryKey: keys.chats, exact: true });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AppSettings>) => api.updateSettings(input),
    onSuccess: (data) => qc.setQueryData(keys.settings, data),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProfileInput }) => api.updateProfile(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.settings }),
  });
}
