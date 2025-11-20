<template>
    <img 
        :src="flagImagePath" 
        :alt="`${props.country} flag`"
        class="inline-block w-4 h-3 object-cover rounded-sm"
        @error="onImageError"
        :style="{ display: imageError ? 'none' : 'inline-block' }"
    />
</template>

<script setup>
import { computed, ref } from 'vue'

// Props
const props = defineProps({
    country: {
        type: String,
        // required: true
    },
    size: {
        type: String,
        default: 'md',
        validator: (value) => ['xs', 'sm', 'md', 'lg'].includes(value)
    }
})

// State
const imageError = ref(false)

// Computed image path
const flagImagePath = computed(() => {
    const code = props.country?.toLowerCase()?.trim()
    return `/images/country-flags/${code}.svg`
})

// Handle image load error
const onImageError = () => {
    imageError.value = true
}

// Size classes
const sizeClasses = computed(() => {
    switch(props.size) {
        case 'xs': return 'w-3 h-2'
        case 'sm': return 'w-3.5 h-2.5' 
        case 'md': return 'w-4 h-3'
        case 'lg': return 'w-5 h-4'
        default: return 'w-4 h-3'
    }
})
</script>

<style scoped>
img {
    vertical-align: middle;
}
</style>