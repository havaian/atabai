<!-- frontend/src/components/CursorEffect.vue -->
<!-- Teleport to body — renders above everything, pointer-events: none -->

<template>
    <Teleport to="body">
        <!-- Canvas for wave ripples (desktop mousemove + mobile touch) -->
        <canvas ref="canvasEl" class="cursor-canvas" aria-hidden="true" />

        <!-- Custom cursor — desktop only, hidden on touch devices -->
        <div v-if="!isTouch" class="cursor-dot" ref="dotEl" aria-hidden="true" />
        <div v-if="!isTouch" class="cursor-ring" ref="ringEl" aria-hidden="true"
            :class="{ 'cursor-ring--hover': isHover, 'cursor-ring--clicking': isClicking }" />
    </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// ─── Refs ─────────────────────────────────────────────────────────────────────
const canvasEl = ref(null)
const dotEl = ref(null)
const ringEl = ref(null)

const isTouch = ref(false)
const isHover = ref(false)
const isClicking = ref(false)

// ─── Accent color ─────────────────────────────────────────────────────────────
const ACCENT = { r: 149, g: 0, b: 255 }

// ─── Canvas ripple state ───────────────────────────────────────────────────────
let ctx = null
let ripples = []
let rafId = null
let lastRipple = 0

// Throttle: one ripple per N ms while moving
const RIPPLE_THROTTLE = 40

function spawnRipple(x, y) {
    ripples.push({
        x, y,
        r: 0,
        maxR: 55 + Math.random() * 25,   // 55–80px
        alpha: 0.22,
        speed: 1.4 + Math.random() * 0.8  // px per frame
    })
}

function drawRipples() {
    if (!ctx || !canvasEl.value) return

    ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height)

    ripples = ripples.filter(rp => rp.alpha > 0.004)

    for (const rp of ripples) {
        rp.r += rp.speed
        rp.alpha *= 0.93   // fade multiplier per frame

        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${ACCENT.r}, ${ACCENT.g}, ${ACCENT.b}, ${rp.alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
    }

    rafId = requestAnimationFrame(drawRipples)
}

// ─── Custom cursor lerp state ──────────────────────────────────────────────────
let mouse = { x: -200, y: -200 }
let ring = { x: -200, y: -200 }
let cursorRaf = null

function lerpCursor() {
    if (!dotEl.value || !ringEl.value) return

    // Dot: exact
    dotEl.value.style.transform = `translate(${mouse.x - 4}px, ${mouse.y - 4}px)`

    // Ring: lerp toward mouse
    ring.x += (mouse.x - ring.x) * 0.13
    ring.y += (mouse.y - ring.y) * 0.13
    ringEl.value.style.transform = `translate(${ring.x - 18}px, ${ring.y - 18}px)`

    cursorRaf = requestAnimationFrame(lerpCursor)
}

// ─── Interactive element detection ────────────────────────────────────────────
const HOVER_SELECTORS = 'a, button, [role="button"], input, textarea, select, label, [tabindex]'

function isInteractive(el) {
    return !!el?.closest(HOVER_SELECTORS)
}

// ─── Event handlers ───────────────────────────────────────────────────────────
function onMouseMove(e) {
    mouse.x = e.clientX
    mouse.y = e.clientY

    isHover.value = isInteractive(e.target)

    const now = performance.now()
    if (now - lastRipple > RIPPLE_THROTTLE) {
        spawnRipple(e.clientX, e.clientY)
        lastRipple = now
    }
}

function onMouseDown() { isClicking.value = true }
function onMouseUp() { isClicking.value = false }

function onTouchStart(e) {
    for (const t of e.touches) {
        spawnRipple(t.clientX, t.clientY)
        // Extra burst on tap start
        spawnRipple(t.clientX, t.clientY)
    }
}

function onTouchMove(e) {
    const now = performance.now()
    if (now - lastRipple > RIPPLE_THROTTLE) {
        for (const t of e.touches) spawnRipple(t.clientX, t.clientY)
        lastRipple = now
    }
}

// ─── Canvas resize ────────────────────────────────────────────────────────────
function resizeCanvas() {
    if (!canvasEl.value) return
    canvasEl.value.width = window.innerWidth
    canvasEl.value.height = window.innerHeight
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
    // Detect touch-only device
    isTouch.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches

    // Canvas setup
    ctx = canvasEl.value.getContext('2d')
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Start ripple loop
    rafId = requestAnimationFrame(drawRipples)

    // Start cursor lerp loop (desktop only)
    if (!isTouch.value) {
        cursorRaf = requestAnimationFrame(lerpCursor)
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('mouseup', onMouseUp)
    }

    // Touch ripples (mobile)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
})

onUnmounted(() => {
    cancelAnimationFrame(rafId)
    cancelAnimationFrame(cursorRaf)
    window.removeEventListener('resize', resizeCanvas)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
})
</script>

<style scoped>
/* Canvas — full viewport overlay, above everything, no pointer interception */
.cursor-canvas {
    position: fixed;
    inset: 0;
    z-index: 9990;
    pointer-events: none;
    width: 100vw;
    height: 100vh;
}

/* Cursor dot — 8px solid */
.cursor-dot {
    position: fixed;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #9500FF;
    pointer-events: none;
    z-index: 9999;
    will-change: transform;
    transition: width 0.2s, height 0.2s, background 0.2s;
}

/* Cursor ring — 36px outline */
.cursor-ring {
    position: fixed;
    top: 0;
    left: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid rgba(149, 0, 255, 0.55);
    pointer-events: none;
    z-index: 9998;
    will-change: transform;
    /* ring morphs via width/height, not scale */
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        background 0.25s,
        border-color 0.25s,
        border-radius 0.25s;
}

/* Hover state: ring expands, fills slightly */
.cursor-ring--hover {
    width: 52px;
    height: 52px;
    border-color: rgba(149, 0, 255, 0.8);
    background: rgba(149, 0, 255, 0.08);
}

/* Click state: ring contracts + brightens */
.cursor-ring--clicking {
    width: 28px;
    height: 28px;
    border-color: #9500FF;
    background: rgba(149, 0, 255, 0.15);
}
</style>

<!-- Hide native cursor globally on non-touch devices -->
<style>
@media (hover: hover) and (pointer: fine) {

    *,
    *::before,
    *::after {
        cursor: none !important;
    }
}
</style>