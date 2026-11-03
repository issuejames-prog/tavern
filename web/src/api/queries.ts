import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppSettings, ChatDetail, WorldBook } from '@tavern/shared';
import { api, type CharacterInput, type ProfileInput } from './index';

export const keys = {
  characters: ['characters'] as const,
  character: (id: number) => ['characters', id] as const,
  chats: ['chats'] as const,
  chat: (id: number) => ['chats', id] as const,
  worlds: ['worlds'] as const,
  world: (id: number) => ['worlds', id] as const,
  settings: ['settings'] as const,
};

export const useCharacters = () => useQuery({ queryKey: keys.characters, queryFn: () => api.listCharacters() });
export const useCharacter = (id: number | null) =>
  useQuery({ queryKey: keys.character(id ?? 0), queryFn: () => api.getCharacter(id!), enabled: id !== null });
export const useChats = () => useQuery({ queryKey: keys.chats, queryFn: () => api.listChats() });
export const useChat = (id: number) => useQuery({ queryKey: keys.chat(id), queryFn: () => api.getChat(id) });
export const useWorldBooks = () => useQuery({ queryKey: keys.worlds, queryFn: () => api.listWorldBooks() });
export const useWorldBook = (id: number) => useQuery({ queryKey: keys.world(id), queryFn: () => api.getWorldBook(id) });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() });

/** Characters, chats and world books reference each other (names, avatars, links), so refresh them together. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.characters });
    void qc.invalidateQueries({ queryKey: keys.chats });
    void qc.invalidateQueries({ queryKey: keys.worlds });
  };
}

export function useSaveCharacter() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: CharacterInput }) =>
      id === null ? api.createCharacter(input) : api.updateCharacter(id, input),
    onSuccess: (detail) => {
      qc.setQueryData(keys.character(detail.id), detail);
      refresh();
    },
  });
}

export function useSetAvatar() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File | null }) => api.setAvatar(id, file),
    onSuccess: (detail) => {
      qc.setQueryData(keys.character(detail.id), detail);
      refresh();
    },
  });
}

export function useImportCharacter() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (file: File) => api.importCharacter(file), onSuccess: refresh });
}

export function useDeleteCharacter() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (id: number) => api.deleteCharacter(id), onSuccess: refresh });
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

export function useCreateWorldBook() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (name: string) => api.createWorldBook(name), onSuccess: refresh });
}

export function useImportWorldBook() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (file: File) => api.importWorldBook(file), onSuccess: refresh });
}

export function useSaveWorldBook() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (book: WorldBook) => api.saveWorldBook(book),
    onSuccess: (saved) => {
      qc.setQueryData(keys.world(saved.id), saved);
      refresh();
    },
  });
}

export function useDeleteWorldBook() {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (id: number) => api.deleteWorldBook(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.world(id) });
      refresh();
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
    mutationFn: (input: ProfileInput) => api.updateProfile(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

export function useImportBackup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (file: File) => api.importBackup(file), onSuccess: () => void qc.invalidateQueries() });
}
