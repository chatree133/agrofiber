import axios from "axios";

const apiClient = axios.create({
    baseURL: "/",
    timeout: 20000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    withCredentials: true,
});

const getToken = () => {
    try {
        return localStorage.getItem("token");
    } catch {
        return null;
    }
};

const clearAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

const forceLogout = () => {
    clearAuth();

    const basePath =
        (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "") || "";

    const loginPath = `${basePath}/login`;

    if (window.location.pathname !== loginPath) {
        window.location.assign(loginPath);
    }
};

apiClient.interceptors.request.use(
    (config) => {
        const token = getToken();

        if (token) {
            config.headers = {
                ...config.headers,
                Authorization: `Bearer ${token}`,
            };
        }

        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const status = error.response?.status ?? 0;

        if (status === 401) {
            forceLogout();
        }

        const message =
            error.response?.data?.message ||
            error.message ||
            "Unexpected error";

        const err = new Error(message);

        err.status = status;
        err.data = error.response?.data;
        // Preserve axios-like shape for callers that expect `err.response.data.message`.
        err.response = error.response;

        throw err;
    }
);

export default class ApiClient {
    static get(endpoint, params, config) {
        if (config !== undefined) {
        return apiClient.get(endpoint, { params, ...config });
    }

    const candidate = params || {};
    const hasConfigShape = candidate.headers || candidate.responseType || candidate.withCredentials || candidate.auth || candidate.params;

    if (hasConfigShape) {
        const { params: actualParams, ...rest } = candidate;
        return apiClient.get(endpoint, { params: actualParams, ...rest });
    }

    return apiClient.get(endpoint, { params: candidate });
    }

    static post(endpoint, data, config) {
        return apiClient.post(endpoint, data, config);
    }

    static put(endpoint, data, config) {
        return apiClient.put(endpoint, data, config);
    }

    static patch(endpoint, data, config) {
        return apiClient.patch(endpoint, data, config);
    }

    static delete(endpoint, config) {
        return apiClient.delete(endpoint, config);
    }

    static upload(endpoint, formData) {
        return apiClient.post(endpoint, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    }

    static download(endpoint, params, config) {
        return apiClient.get(endpoint, {
            params,
            responseType: "blob",
            ...config,
        });
    }
}
