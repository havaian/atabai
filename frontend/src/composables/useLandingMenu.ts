// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/composables/useLandingMenu.js.
 * Behavior preserved 1:1; types tightened later.
 */

// frontend/src/composables/useLandingMenu.js

import { ref } from 'vue'

// Module-level singleton - shared across all imports
const menuOpen = ref(false)

export function useLandingMenu() {
    return { menuOpen }
}