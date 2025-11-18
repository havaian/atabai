import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/plugins/axios'

export function useUserPreferences() {
    const authStore = useAuthStore()
    const isLoading = ref(false)
    const error = ref(null)

    /**
     * Update user preferences
     * @param {Object} preferences - The preferences to update
     * @param {string} preferences.language - User's preferred language
     * @param {string} preferences.theme - User's preferred theme (light/dark/system)
     */
    const updateUserPreferences = async (preferences) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await api.patch('/users/preferences', { preferences })

            if (response.data.success) {
                // Update the auth store with new user data
                if (authStore.user) {
                    authStore.user.preferences = {
                        ...authStore.user.preferences,
                        ...preferences
                    }
                }

                return response.data
            } else {
                throw new Error(response.data.message || 'Failed to update preferences')
            }
        } catch (err) {
            error.value = err.message || 'An error occurred while updating preferences'
            console.error('Error updating preferences:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Get user preferences
     */
    const getUserPreferences = async () => {
        isLoading.value = true
        error.value = null

        try {
            const response = await api.get('/users/preferences')

            if (response.data.success) {
                return response.data.preferences
            } else {
                throw new Error(response.data.message || 'Failed to get preferences')
            }
        } catch (err) {
            error.value = err.message || 'An error occurred while fetching preferences'
            console.error('Error getting preferences:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Reset preferences to default
     */
    const resetPreferences = async () => {
        const defaultPreferences = {
            language: 'ru',
            theme: 'system'
        }

        return await updateUserPreferences(defaultPreferences)
    }

    return {
        isLoading,
        error,
        updateUserPreferences,
        getUserPreferences,
        resetPreferences
    }
}