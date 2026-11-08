import api from './api';
import type { MyBeautyLeadFilters, MyBeautyLeadResponse } from '../types/myBeautyLead';

/**
 * The CRM backend proxies this request through the configured My Beauty
 * Project. This keeps the external project API key out of the browser.
 */
export async function fetchMyBeautyLeads(
  projectId: number,
  params: MyBeautyLeadFilters,
): Promise<MyBeautyLeadResponse> {
  const { data } = await api.get<MyBeautyLeadResponse>(
    `/projects/${projectId}/mybeauty/leads`,
    { params },
  );
  return data;
}
