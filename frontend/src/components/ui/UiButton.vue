<!-- frontend/src/components/ui/UiButton.vue
     Shared button for the app surface. Uses the .ui-btn namespace - NOT the
     global .btn-* classes, which belong to the landing page and are not
     theme-aware - so every app button is driven by --ws-* tokens and renders
     correctly in both light and dark themes (fixes the white-on-white hover).

     Variants: primary | ghost | secondary | danger. Pass icon + label as the
     default slot, e.g. <UiButton><CloudUpload :size="16" /> Upload</UiButton>.
     No transform-based hover, per project convention. -->
<template>
    <button
        :type="type"
        class="ui-btn"
        :class="[`ui-btn--${variant}`, { 'ui-btn--block': block, 'ui-btn--sm': size === 'sm' }]"
        :disabled="disabled || loading"
    >
        <span v-if="loading" class="ui-btn-spinner" aria-hidden="true" />
        <slot />
    </button>
</template>

<script setup lang="ts">
// @ts-nocheck
defineProps({
    // primary | ghost | secondary | danger
    variant: { type: String, default: 'primary' },
    type: { type: String, default: 'button' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
    // md | sm
    size: { type: String, default: 'md' },
})
</script>

<style scoped>
.ui-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    font-family: inherit;
    line-height: 1.2;
    cursor: pointer;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ws-text);
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ui-btn:focus-visible { outline: 2px solid var(--ws-purple); outline-offset: 2px; }
.ui-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ui-btn--sm { padding: 6px 12px; font-size: 0.84rem; }
.ui-btn--block { display: flex; width: 100%; }

/* primary - solid purple */
.ui-btn--primary { background: var(--ws-purple); color: #fff; border-color: var(--ws-purple); }
.ui-btn--primary:hover:not(:disabled) { background: #6D28D9; border-color: #6D28D9; color: #fff; }

/* ghost - transparent; hover lands a token surface + token text so it stays
   readable in BOTH themes (the bug we are fixing). */
.ui-btn--ghost { background: transparent; color: var(--ws-text-2); border-color: var(--ws-border-2); }
.ui-btn--ghost:hover:not(:disabled) {
    background: var(--ws-surface-2);
    color: var(--ws-text);
    border-color: var(--ws-border);
}

/* secondary - outlined purple, for tertiary actions */
.ui-btn--secondary { background: transparent; color: var(--ws-purple); border-color: var(--ws-purple); }
.ui-btn--secondary:hover:not(:disabled) { background: var(--ws-purple-lt); color: var(--ws-purple); }

/* danger - destructive */
.ui-btn--danger { background: transparent; color: #ef4444; border-color: rgba(239, 68, 68, 0.5); }
.ui-btn--danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.7);
}

.ui-btn-spinner {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    opacity: 0.7;
    animation: ui-btn-spin 0.7s linear infinite;
}
@keyframes ui-btn-spin { to { transform: rotate(360deg); } }
</style>
