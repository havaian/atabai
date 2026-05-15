<template>
    <div class="adm-page">
        <h1 class="adm-page-title">Access page works</h1>
        <p>If you see this — AdminAccess.vue mounts successfully.</p>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
onMounted(() => {
    console.log('[AdminAccess] mounted')
})
</script>