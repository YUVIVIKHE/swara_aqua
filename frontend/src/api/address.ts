import api from './axios';

export interface UserAddress {
  id: number;
  user_id: number;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export const addressApi = {
  list: () =>
    api.get<{ addresses: UserAddress[] }>('/addresses'),

  add: (data: { label: string; address: string; latitude?: number; longitude?: number; isDefault?: boolean }) =>
    api.post<{ message: string; id: number }>('/addresses', data),

  update: (id: number, data: { label?: string; address?: string; latitude?: number; longitude?: number }) =>
    api.patch(`/addresses/${id}`, data),

  setDefault: (id: number) =>
    api.patch(`/addresses/${id}/default`),

  delete: (id: number) =>
    api.delete(`/addresses/${id}`),

  // alias for delete
  remove: (id: number) =>
    api.delete(`/addresses/${id}`),
};
