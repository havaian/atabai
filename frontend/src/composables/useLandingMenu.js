// frontend/src/composables/useLandingMenu.js

import { ref } from 'vue'

// Module-level singleton — shared across all imports
const menuOpen = ref(false)

export function useLandingMenu() {
    return { menuOpen }
}