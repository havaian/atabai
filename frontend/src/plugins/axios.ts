// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/plugins/axios.js.
 * Behavior preserved 1:1; types tightened later.
 */

import axios from 'axios'

// Create axios instance with default configuration
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
    withCredentials: true,
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
})

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add auth token if available
        const token = localStorage.getItem('accessToken')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }

        // Attach the active organization id on every request so the backend
        // can org-scope user-side endpoints (Task 6). Read from the SAME
        // localStorage key the organizations store persists into - we read
        // directly here rather than importing the store because this module
        // is initialized before Pinia (createPinia() runs in main.ts after
        // this file is imported). The store mirrors the server's chosen
        // activeOrgId back into localStorage on every /session response, so
        // the value seen here is whatever the backend last blessed.
        //
        // Skip the header when explicitly suppressed via config.skipActiveOrgHeader
        // - useful for the /session call itself if you want to ask "what's my
        // current active org?" without prejudicing the answer (we don't use
        // that escape hatch today, but leaving the door open).
        if (!config.skipActiveOrgHeader) {
            try {
                const activeOrgId = localStorage.getItem('atabai-active-org-id')
                if (activeOrgId) {
                    config.headers['X-Active-Org-Id'] = activeOrgId
                }
            } catch (_) {
                // localStorage may be unavailable (Safari private mode,
                // embedded contexts). Non-fatal - backend will just treat
                // the request as having no active org and most user-side
                // list endpoints will return empty.
            }
        }

        // Log request in development
        if (import.meta.env.DEV) {
            console.log('API Request:', config.method?.toUpperCase(), config.url)
        }

        return config
    },
    (error) => {
        console.error('Request error:', error)
        return Promise.reject(error)
    }
)

// Response interceptor
apiClient.interceptors.response.use(
    (response) => {
        // Log response in development
        if (import.meta.env.DEV) {
            console.log('API Response:', response.status, response.config.url)
        }

        return response
    },
    async (error) => {
        const originalRequest = error.config

        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            try {
                // Try to refresh token
                const refreshToken = localStorage.getItem('refreshToken')
                if (refreshToken) {
                    // Use apiClient (not the bare `axios` import) so the call
                    // resolves against VITE_API_BASE_URL. The bare axios.post
                    // hit the frontend origin (e.g. :5173/api/auth/refresh in
                    // dev) which 404s, making every access-token expiry fall
                    // into the catch below and force a logout/redirect. The
                    // path is relative ('/auth/refresh', no '/api' prefix)
                    // because baseURL already includes '/api'. The outer
                    // request's _retry guard prevents a refresh loop.
                    const response = await apiClient.post('/auth/refresh', {
                        refreshToken
                    })

                    const { accessToken } = response.data
                    localStorage.setItem('accessToken', accessToken)

                    // Retry original request with new token
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`
                    return apiClient(originalRequest)
                }
            } catch (refreshError) {
                // Refresh failed, redirect to login
                console.error('Token refresh failed:', refreshError)
                localStorage.removeItem('accessToken')
                localStorage.removeItem('refreshToken')
                localStorage.removeItem('user')

                // Redirect to login page
                window.location.href = '/'
            }
        }

        // Handle network errors
        if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') {
            console.error('Network error:', error.message)
            // You can show a global network error message here
        }

        // Log error in development
        if (import.meta.env.DEV) {
            console.error('API Error:', error.response?.status, error.config?.url, error.message)
        }

        return Promise.reject(error)
    }
)

// Vue plugin installation function
export default {
    install(app) {
        // Make axios available globally as $http
        app.config.globalProperties.$http = apiClient

        // Make axios available via provide/inject
        app.provide('$http', apiClient)
    }
}

// Export the configured axios instance for direct use
export { apiClient }