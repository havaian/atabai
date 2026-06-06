<!-- frontend/src/components/ui/UiModal.vue
     Shared modal: teleported to <body>, backdrop + fade, Esc and click-outside
     to close, header with title + close button, body slot, optional footer
     slot. Styled with --ws-* tokens.

     Usage:
       <UiModal v-model="open" :title="$t('...')">
         body content
         <template #footer> ...buttons... </template>
       </UiModal> -->
<template>
    <Teleport to="body">
        <Transition name="ui-modal-fade">
            <div v-if="modelValue" class="ui-modal-backdrop" @click.self="close">
                <div class="ui-modal-card" :style="{ maxWidth }" role="dialog" aria-modal="true">
                    <header v-if="title || $slots.header" class="ui-modal-header">
                        <slot name="header">
                            <h2 class="ui-modal-title">{{ title }}</h2>
                        </slot>
                        <button class="ui-modal-close" type="button" :aria-label="closeLabel" @click="close">
                            <X :size="18" />
                        </button>
                    </header>
                    <div class="ui-modal-body">
                        <slot />
                    </div>
                    <footer v-if="$slots.footer" class="ui-modal-footer">
                        <slot name="footer" />
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    maxWidth: { type: String, default: '460px' },
    closeLabel: { type: String, default: 'Close' },
})
const emit = defineEmits(['update:modelValue', 'close'])

function close() {
    emit('update:modelValue', false)
    emit('close')
}
function onKey(e) {
    if (e.key === 'Escape' && props.modelValue) close()
}

watch(
    () => props.modelValue,
    (open) => {
        if (open) document.addEventListener('keydown', onKey)
        else document.removeEventListener('keydown', onKey)
    },
)
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.ui-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
}
.ui-modal-card {
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}
.ui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--ws-border);
}
.ui-modal-title { font-size: 1.05rem; font-weight: 600; color: var(--ws-text); margin: 0; }
.ui-modal-close {
    background: none;
    border: none;
    color: var(--ws-text-3);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: inline-flex;
    flex-shrink: 0;
}
.ui-modal-close:hover { color: var(--ws-text); background: var(--ws-surface-2); }
.ui-modal-body { padding: 20px; }
.ui-modal-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 14px 20px;
    border-top: 1px solid var(--ws-border);
}
.ui-modal-fade-enter-active, .ui-modal-fade-leave-active { transition: opacity 0.15s; }
.ui-modal-fade-enter-from, .ui-modal-fade-leave-to { opacity: 0; }
</style>
