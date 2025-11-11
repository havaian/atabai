import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

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

            // Redirect directly to Google OAuth (ORIGINAL WORKING VERSION)
            const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&` +
                `redirect_uri=${encodeURIComponent(window.location.origin)}/auth/callback&` +
                `response_type=code&` +
                `scope=profile email&` +
                `access_type=offline&` +
                `prompt=consent`

            console.log('🔧 Redirecting to Google OAuth:', googleAuthUrl)

            // Redirect to Google OAuth
            window.location.href = googleAuthUrl
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

            const response = await apiClient.post('/auth/google/callback', { code })
            const { user: userData, accessToken: access, refreshToken: refresh } = response.data

            user.value = userData
            accessToken.value = access
            refreshToken.value = refresh

            // Persist tokens to localStorage
            persistTokens()

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
            const response = await apiClient.post('/auth/refresh', {
                refreshToken: refreshToken.value
            })

            const { accessToken: newAccessToken } = response.data
            accessToken.value = newAccessToken

            // Persist the new token
            persistTokens()

            return newAccessToken
        } catch (err) {
            // Clear tokens on refresh failure
            await logout()
            throw err
        }
    }

    // Check authentication status on app initialization
    async function checkAuth() {
        try {
            // Check if we have tokens in localStorage or sessionStorage
            const storedAccessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
            const storedRefreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
            const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')

            if (storedAccessToken && storedUser) {
                accessToken.value = storedAccessToken
                refreshToken.value = storedRefreshToken
                user.value = JSON.parse(storedUser)

                // Verify token is still valid by fetching user profile
                const response = await apiClient.get('/auth/profile')
                if (response.data.success) {
                    user.value = response.data.user
                    return true
                }
            }
        } catch (err) {
            // Clear invalid tokens
            await logout()
            console.log('No valid authentication found')
        }
        return false
    }

    // Store tokens to localStorage
    function persistTokens() {
        if (accessToken.value) {
            localStorage.setItem('accessToken', accessToken.value)
            localStorage.setItem('user', JSON.stringify(user.value))
            if (refreshToken.value) {
                localStorage.setItem('refreshToken', refreshToken.value)
            }
        }
    }

    async function logout() {
        try {
            if (accessToken.value) {
                await apiClient.post('/auth/logout')
            }
        } catch (err) {
            console.error('Logout error:', err)
        } finally {
            // Clear state
            user.value = null
            accessToken.value = null
            refreshToken.value = null
            error.value = null

            // Clear localStorage
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
            sessionStorage.removeItem('accessToken')
            sessionStorage.removeItem('refreshToken')
            sessionStorage.removeItem('user')
        }
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
        handleOAuthCallback,
        refreshAccessToken,
        logout,
        checkAuth,
        persistTokens
    }
})