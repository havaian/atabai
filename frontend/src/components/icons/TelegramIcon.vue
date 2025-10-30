<template>
    <svg :class="className" :width="size" :height="size" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <!-- Telegram paper plane icon - larger and more accurate -->
        <path 
            :fill="color" 
            d="M22.05 1.577c.393-.016.766.198.934.55.168.353.092.777-.196 1.09L11.842 21.532c-.297.322-.733.456-1.15.325-.418-.131-.734-.48-.832-.906l-2.764-12.21L19.695 4.02 8.417 11.48 4.248 10.38c-.427-.113-.776-.455-.906-.89-.13-.435.031-.888.417-1.17L21.044 1.717c.317-.238.696-.216 1.006-.14z"
        />
    </svg>
</template>

<script setup>
// Props with default values
defineProps({
    size: {
        type: [String, Number],
        default: '24'
    },
    className: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        default: 'currentColor'
    }
})
</script>