import api from './api';
import type { MyDoctorLeadFilters, MyDoctorLeadResponse } from '../types/myDoctorPlusLead';

/**
 * This request is proxied by Leo X24's Laravel backend. The My Doctor Plus
 * integration key remains encrypted on the CRM server and is never sent to
 * the browser.
 */
export async function fetchMyDoctorPlusLeads(
  projectId: number,
  params: MyDoctorLeadFilters,
): Promise<MyDoctorLeadResponse> {
  const { data } = await api.get<MyDoctorLeadResponse>(
    `/projects/${projectId}/mydoctorplus/leads`,
    { params },
  );
  return data;
}
