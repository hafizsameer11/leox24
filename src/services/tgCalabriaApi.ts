import axios from 'axios';
import type { TgRegistrationResponse } from '../types/tgRegistration';

const tgCalabriaApi = axios.create({
  baseURL:
    import.meta.env.VITE_TG_CALABRIA_API_URL ||
    'https://api.tgcalabriareport.com/api/v1',
  headers: {
    Accept: 'application/json',
  },
});

export interface FetchTgRegistrationsParams {
  page?: number;
  limit?: number;
  role?: string;
}

export async function fetchTgRegistrations(
  params: FetchTgRegistrationsParams = {}
): Promise<TgRegistrationResponse> {
  const { data } = await tgCalabriaApi.get<TgRegistrationResponse>(
    '/users/public/registration',
    { params }
  );
  return data;
}

export default tgCalabriaApi;
