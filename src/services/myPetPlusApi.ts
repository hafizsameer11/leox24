import api from './api';
import type { MyPetPlusLeadFilters, MyPetPlusLeadResponse } from '../types/myPetPlusLead';

/**
 * The CRM backend proxies this request through the configured MyPet Plus
 * Project. This keeps the external project API key out of the browser.
 */
export async function fetchMyPetPlusLeads(
  projectId: number,
  params: MyPetPlusLeadFilters,
): Promise<MyPetPlusLeadResponse> {
  const { data } = await api.get<MyPetPlusLeadResponse>(
    `/projects/${projectId}/mypetplus/leads`,
    { params },
  );
  return data;
}
