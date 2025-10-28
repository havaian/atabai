import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref(null)
    const accessToken = ref(null)
    const refreshToken = ref(null)
    const isLoading = ref(false)
    const error = ref(null)

    // Getters
    const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
    const subscriptionType = computed(() => user.value?.subscriptionType || 'basic')
    const isPremium = computed(() => subscriptionType.value === 'premium')
    const filesProcessedThisMonth = computed(() => user.value?.filesProcessedThisMonth || 0)
    const monthlyLimit = computed(() => subscriptionType.value === 'basic' ? 5 : Infinity)
    const canProcessFiles = computed(() => filesProcessedThisMonth.value < monthlyLimit.value)

    // Actions
    async function login() {
        try {
            isLoading.value = true
            error.value = null

            // Redirect to Google OAuth
            const response = await axios.get('/api/auth/google')
            window.location.href = response.data.authUrl
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to initiate login'
            console.error('Login error:', err)
        } finally {
            isLoading.value = false
        }
    }

    async function handleOAuthCallback(code) {
        try {
            isLoading.value = true
            error.value = null

            const response = await axios.post('/api/auth/google/callback', { code })
            const { user: userData, accessToken: access, refreshToken: refresh } = response.data

            user.value = userData
            accessToken.value = access
            refreshToken.value = refresh

            // Set axios default authorization header
            axios.defaults.headers.common['Authorization'] = `Bearer ${access}`

            return userData
        } catch (err) {
            error.value = err.response?.data?.message || 'OAuth callback failed'
            console.error('OAuth callback error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function refreshAccessToken() {
        if (!refreshToken.value) {
            throw new Error('No refresh token available')
        }

        try {
            const response = await axios.post('/api/auth/refresh', {
                refreshToken: refreshToken.value
            })

            const { accessToken: newAccessToken } = response.data
            accessToken.value = newAccessToken
            axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`

            return newAccessToken
        } catch (err) {
            console.error('Token refresh failed:', err)
            await logout()
            throw err
        }
    }

    async function checkAuth() {
        const storedToken = localStorage.getItem('accessToken')
        const storedRefreshToken = localStorage.getItem('refreshToken')
        const storedUser = localStorage.getItem('user')

        if (storedToken && storedRefreshToken && storedUser) {
            try {
                accessToken.value = storedToken
                refreshToken.value = storedRefreshToken
                user.value = JSON.parse(storedUser)

                // Set axios header
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`

                // Verify token validity by fetching user profile
                await fetchProfile()
            } catch (err) {
                console.error('Token validation failed:', err)
                await logout()
            }
        }
    }

    async function fetchProfile() {
        try {
            const response = await axios.get('/api/auth/profile')
            user.value = response.data
            localStorage.setItem('user', JSON.stringify(response.data))
            return response.data
        } catch (err) {
            if (err.response?.status === 401) {
                // Try to refresh token
                try {
                    await refreshAccessToken()
                    const retryResponse = await axios.get('/api/auth/profile')
                    user.value = retryResponse.data
                    localStorage.setItem('user', JSON.stringify(retryResponse.data))
                    return retryResponse.data
                } catch (refreshErr) {
                    console.error('Profile fetch after refresh failed:', refreshErr)
                    await logout()
                    throw refreshErr
                }
            }
            throw err
        }
    }

    async function logout() {
        try {
            // Call logout endpoint if we have a token
            if (accessToken.value) {
                await axios.post('/api/auth/logout')
            }
        } catch (err) {
            console.error('Logout API call failed:', err)
            // Continue with local logout even if API call fails
        }

        // Clear state
        user.value = null
        accessToken.value = null
        refreshToken.value = null
        error.value = null

        // Clear localStorage
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')

        // Clear axios header
        delete axios.defaults.headers.common['Authorization']

        // Redirect to home page
        window.location.href = '/'
    }

    async function updateProfile(profileData) {
        try {
            isLoading.value = true
            const response = await axios.put('/api/auth/profile', profileData)
            user.value = response.data
            localStorage.setItem('user', JSON.stringify(response.data))
            return response.data
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to update profile'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // Axios interceptor for automatic token refresh
    function setupAxiosInterceptors() {
        axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const original = error.config

                if (error.response?.status === 401 && !original._retry) {
                    original._retry = true

                    try {
                        await refreshAccessToken()
                        return axios(original)
                    } catch (refreshError) {
                        await logout()
                        return Promise.reject(refreshError)
                    }
                }

                return Promise.reject(error)
            }
        )
    }

    // Persist state to localStorage
    function persistState() {
        if (accessToken.value) localStorage.setItem('accessToken', accessToken.value)
        if (refreshToken.value) localStorage.setItem('refreshToken', refreshToken.value)
        if (user.value) localStorage.setItem('user', JSON.stringify(user.value))
    }

    // Watch for state changes and persist
    function initializePersistence() {
        // Save tokens when they change
        watch([accessToken, refreshToken, user], persistState, { deep: true })
    }

    return {
        // State
        user,
        accessToken,
        refreshToken,
        isLoading,
        error,

        // Getters
        isAuthenticated,
        subscriptionType,
        isPremium,
        filesProcessedThisMonth,
        monthlyLimit,
        canProcessFiles,

        // Actions
        login,
        logout,
        checkAuth,
        fetchProfile,
        updateProfile,
        handleOAuthCallback,
        refreshAccessToken,
        setupAxiosInterceptors,
        initializePersistence
    }
}, {
    persist: {
        key: 'atabai-auth',
        storage: localStorage,
        paths: ['user', 'accessToken', 'refreshToken']
    }
})