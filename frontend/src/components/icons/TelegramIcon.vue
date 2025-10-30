<template>
    <svg :class="className" :width="size" :height="size" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <!-- Telegram paper plane icon - clean, large, and recognizable -->
        <path 
            :fill="color" 
            d="M22.269 2.316c.748-.047 1.336.598 1.211 1.329L20.367 20.863c-.1.583-.603.972-1.177.91-.201-.022-.4-.086-.576-.189L12 18.5l-3.707 4.365c-.532.626-1.54.251-1.54-.574v-5.318L2.316 15.05c-.75-.213-1.07-1.155-.529-1.56L22.269 2.316z"
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