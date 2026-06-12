import { createContext, useContext, useMemo } from 'react';
import ApiClient from './Api';
import { useAuth } from './AuthContext.jsx';

const AuditContext = createContext(null);

export function AuditProvider({ children }) {
  const { authHeaders } = useAuth();

  const getAuditLogs = async (params = {}) => {
    const res = await ApiClient.get('/api/audit-logs', params, { headers: authHeaders });
    return res;
  };

  const value = useMemo(() => ({
    getAuditLogs
  }), [authHeaders]);

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  );
}

export const useAudit = () => useContext(AuditContext);
