import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { authHeaders } = useAuth();

  const getCompanies = async () => {
    const data = await ApiClient.get('/api/companies', { headers: authHeaders });
    return data.data;
  };

  const getCompany = async (id) => {
    const data = await ApiClient.get(`/api/companies/${id}`, { headers: authHeaders });
    return data.data;
  };

  const createCompany = async (payload) => {
    const data = await ApiClient.post('/api/companies', payload, { headers: authHeaders });
    return data.data;
  };

  const updateCompany = async (id, payload) => {
    const data = await ApiClient.put(`/api/companies/${id}`, payload, { headers: authHeaders });
    return data.data;
  };

  const getBranches = async (companyId) => {
    const data = await ApiClient.get(`/api/companies/${companyId}/branches`, { headers: authHeaders });
    return data.data;
  };

  const createBranch = async (companyId, payload) => {
    const data = await ApiClient.post(`/api/companies/${companyId}/branches`, payload, { headers: authHeaders });
    return data.data;
  };

  const updateBranch = async (companyId, branchId, payload) => {
    const data = await ApiClient.put(`/api/companies/${companyId}/branches/${branchId}`, payload, { headers: authHeaders });
    return data.data;
  };

  const deleteBranch = async (companyId, branchId) => {
    await ApiClient.delete(`/api/companies/${companyId}/branches/${branchId}`, { headers: authHeaders });
  };

  const value = useMemo(() => ({
    getCompanies,
    getCompany,
    createCompany,
    updateCompany,
    getBranches,
    createBranch,
    updateBranch,
    deleteBranch
  }), [authHeaders]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
