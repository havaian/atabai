<template>
    <svg :class="className" :width="size" :height="size" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <!-- Simple, large Telegram paper plane -->
        <path 
            :fill="color" 
            d="M23.9 2.6c.2-.8-.5-1.5-1.3-1.3L1.1 8.7c-.8.3-.8 1.5 0 1.8l5.4 1.4 1.8 6.1c.2.8 1.3 1 1.9.5l2.4-2 4.4 3.4c.7.5 1.7.1 1.9-.7L23.9 2.6zM9.5 11.5l9.8-6.2c.3-.2.6.2.4.4L11 14.8l-.5 4-1-3.3z"
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