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

// ─── Accent colors ────────────────────────────────────────────────────────────
const PURPLE = { r: 149, g: 0, b: 255 }
const WHITE = { r: 255, g: 255, b: 255 }

// Current ripple color — switches when cursor is over purple bg
let rippleColor = PURPLE

// Walk up the DOM to find first element with a non-transparent background.
// If it's purple-ish (matches #9500FF region), return WHITE so cursor is visible.
function resolveAccentForEl(el) {
    let node = el
    while (node && node !== document.body) {
        const bg = window.getComputedStyle(node).backgroundColor
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/)
        if (m) {
            const r = +m[1], g = +m[2], b = +m[3]
            const a = m[4] !== undefined ? +m[4] : 1
            // Skip transparent
            if (a === 0) { node = node.parentElement; continue }
            // "Purple-ish": R > 80, G < 80, B > 120
            if (r > 80 && g < 80 && b > 120) return WHITE
            // Found a non-transparent non-purple bg — stop walking
            break
        }
        node = node.parentElement
    }
    return PURPLE
}

function applyCursorColor(color) {
    if (!dotEl.value || !ringEl.value) return
    const isWhite = color === WHITE

    dotEl.value.style.background = isWhite
        ? 'rgba(255,255,255,0.95)'
        : '#9500FF'

    ringEl.value.style.borderColor = isWhite
        ? 'rgba(255,255,255,0.7)'
        : 'rgba(149,0,255,0.55)'

    // Clear inline bg when switching back to purple (CSS handles hover/click states)
    ringEl.value.style.background = isWhite
        ? 'rgba(255,255,255,0.08)'
        : ''

    rippleColor = color
}

// ─── Canvas ripple state ───────────────────────────────────────────────────────
let ctx = null
let ripples = []
let rafId = null
let lastRipple = 0

const RIPPLE_THROTTLE = 40

function spawnRipple(x, y, color = rippleColor) {
    ripples.push({
        x, y,
        r: 0,
        alpha: 0.22,
        speed: 1.4 + Math.random() * 0.8,
        color
    })
}

function drawRipples() {
    if (!ctx || !canvasEl.value) return

    ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height)

    ripples = ripples.filter(rp => rp.alpha > 0.004)

    for (const rp of ripples) {
        rp.r += rp.speed
        rp.alpha *= 0.93

        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${rp.color.r},${rp.color.g},${rp.color.b},${rp.alpha})`
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

    dotEl.value.style.transform = `translate(${mouse.x - 4}px, ${mouse.y - 4}px)`

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

    // Detect bg color and switch cursor + ripple color accordingly
    const accent = resolveAccentForEl(e.target)
    applyCursorColor(accent)

    const now = performance.now()
    if (now - lastRipple > RIPPLE_THROTTLE) {
        spawnRipple(e.clientX, e.clientY, accent)
        lastRipple = now
    }
}

function onMouseDown() { isClicking.value = true }
function onMouseUp() { isClicking.value = false }

function onTouchStart(e) {
    for (const t of e.touches) {
        spawnRipple(t.clientX, t.clientY, PURPLE)
        spawnRipple(t.clientX, t.clientY, PURPLE)
    }
}

function onTouchMove(e) {
    const now = performance.now()
    if (now - lastRipple > RIPPLE_THROTTLE) {
        for (const t of e.touches) spawnRipple(t.clientX, t.clientY, PURPLE)
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
    isTouch.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches

    ctx = canvasEl.value.getContext('2d')
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    rafId = requestAnimationFrame(drawRipples)

    if (!isTouch.value) {
        cursorRaf = requestAnimationFrame(lerpCursor)
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('mouseup', onMouseUp)
    }

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
.cursor-canvas {
    position: fixed;
    inset: 0;
    z-index: 9990;
    pointer-events: none;
    width: 100vw;
    height: 100vh;
}

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
    transition: background 0.18s;
}

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
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        background 0.18s,
        border-color 0.18s,
        border-radius 0.25s;
}

.cursor-ring--hover {
    width: 52px;
    height: 52px;
}

.cursor-ring--clicking {
    width: 28px;
    height: 28px;
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