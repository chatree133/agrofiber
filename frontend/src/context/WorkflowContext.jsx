import { createContext, useContext, useMemo } from "react";
import ApiClient from "./Api.jsx";
import { useAuth } from "./AuthContext.jsx";

const WorkflowContext = createContext(null);

export function WorkflowProvider({ children }) {
    const { authHeaders } = useAuth();

    const getWorkflowDefinitions = async (params) => {
        const data = await ApiClient.get("/api/workflows/definitions", {
            headers: authHeaders,
            params,
        });
        return data.data;
    };

    const createWorkflowDefinition = async (payload) => {
        const data = await ApiClient.post("/api/workflows/definitions", payload, {
            headers: authHeaders,
        });
        return data.data;
    };

    const updateWorkflowDefinition = async (id, payload) => {
        const data = await ApiClient.put(
            `/api/workflows/definitions/${id}`,
            payload,
            { headers: authHeaders },
        );
        return data.data;
    };

    const getWorkflowSteps = async (definitionId) => {
        const data = await ApiClient.get(
            `/api/workflows/definitions/${definitionId}/steps`,
            { headers: authHeaders },
        );
        return data.data;
    };

    const createWorkflowStep = async (definitionId, payload) => {
        const data = await ApiClient.post(
            `/api/workflows/definitions/${definitionId}/steps`,
            payload,
            { headers: authHeaders },
        );
        return data.data;
    };

    const deleteWorkflowStep = async (definitionId, stepId) => {
        const data = await ApiClient.delete(
            `/api/workflows/definitions/${definitionId}/steps/${stepId}`,
            { headers: authHeaders },
        );
        return data.data;
    };

    const getApprovalRequests = async (params = {}) => {
        const data = await ApiClient.get("/api/approvals", {
            headers: authHeaders,
            params,
        });
        return data;
    };

    const getApprovalRequestDetail = async (id) => {
        const data = await ApiClient.get(`/api/approvals/${id}`, {
            headers: authHeaders,
        });
        return data.data;
    };

    const executeApprovalAction = async (id, action, comments = "") => {
        const data = await ApiClient.post(
            `/api/approvals/${id}/action`,
            { action, comments },
            { headers: authHeaders }
        );
        return data;
    };

    const value = useMemo(
        () => ({
            getWorkflowDefinitions,
            createWorkflowDefinition,
            updateWorkflowDefinition,
            getWorkflowSteps,
            createWorkflowStep,
            deleteWorkflowStep,
            getApprovalRequests,
            getApprovalRequestDetail,
            executeApprovalAction,
        }),
        [authHeaders],
    );

    return (
        <WorkflowContext.Provider value={value}>
            {children}
        </WorkflowContext.Provider>
    );
}

export const useWorkflow = () => useContext(WorkflowContext);

