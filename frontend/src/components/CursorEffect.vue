<!-- frontend/src/components/CursorEffect.vue -->
<!-- Teleport to body — renders above everything, pointer-events: none -->

<template>
    <Teleport to="body">
        <!-- Canvas for wave ripples (desktop mousemove + mobile touch) -->
        <canvas ref="canvasEl" class="cursor-canvas" aria-hidden="true" />

        <!-- Custom cursor — desktop only, hidden on touch devices -->
        <template v-if="!isTouch">
            <div class="cursor-dot" ref="dotEl" aria-hidden="true" />
            <div class="cursor-ring" ref="ringEl" aria-hidden="true"
                :class="{ 'cursor-ring--hover': isHover, 'cursor-ring--clicking': isClicking }" />
        </template>
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

// ─── Canvas ripple state ───────────────────────────────────────────────────────
let ctx = null
let ripples = []
let rafId = null
let lastRipple = 0

const RIPPLE_THROTTLE = 40

function spawnRipple(x, y) {
    // ripples.push({
    //     x, y,
    //     r: 0,
    //     alpha: 0.5,
    //     speed: 1.4 + Math.random() * 0.8
    // })
}

function drawRipples() {
    if (!ctx || !canvasEl.value) return

    ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height)

    ripples = ripples.filter(rp => rp.alpha > 0.004)

    for (const rp of ripples) {
        rp.r += rp.speed
        rp.alpha *= 0.92

        // White ripples — mix-blend-mode: difference on canvas inverts bg
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${rp.alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
    }

    rafId = requestAnimationFrame(drawRipples)
}

// ─── Custom cursor lerp ────────────────────────────────────────────────────────
let mouse = { x: -200, y: -200 }
let ringPos = { x: -200, y: -200 }
let cursorRaf = null

function lerpCursor() {
    if (!dotEl.value || !ringEl.value) return

    dotEl.value.style.transform = `translate(${mouse.x - 4}px, ${mouse.y - 4}px)`

    ringPos.x += (mouse.x - ringPos.x) * 0.13
    ringPos.y += (mouse.y - ringPos.y) * 0.13
    ringEl.value.style.transform = `translate(${ringPos.x - 18}px, ${ringPos.y - 18}px)`

    cursorRaf = requestAnimationFrame(lerpCursor)
}

// ─── Interactive element detection ────────────────────────────────────────────
const HOVER_SELECTORS = 'a, button, [role="button"], input, textarea, select, label, [tabindex]'

// ─── Event handlers ───────────────────────────────────────────────────────────
function onMouseMove(e) {
    mouse.x = e.clientX
    mouse.y = e.clientY

    isHover.value = !!e.target?.closest(HOVER_SELECTORS)

    const now = performance.now()
    // if (now - lastRipple > RIPPLE_THROTTLE) {
    //     spawnRipple(e.clientX, e.clientY)
    //     lastRipple = now
    // }
}

function onMouseDown() { isClicking.value = true }
function onMouseUp() { isClicking.value = false }

function onTouchStart(e) {
    for (const t of e.touches) {
        spawnRipple(t.clientX, t.clientY)
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
/* Canvas — white ripples with difference blend = always inverts bg */
.cursor-canvas {
    position: fixed;
    inset: 0;
    z-index: 9990;
    pointer-events: none;
    width: 100vw;
    height: 100vh;
    mix-blend-mode: difference;
}

/* Dot — solid white, difference blends against whatever is below */
.cursor-dot {
    position: fixed;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    pointer-events: none;
    z-index: 9999;
    will-change: transform;
    mix-blend-mode: difference;
}

/* Ring — white outline, difference blend */
.cursor-ring {
    position: fixed;
    top: 0;
    left: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.85);
    pointer-events: none;
    z-index: 9998;
    will-change: transform;
    mix-blend-mode: difference;
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        border-radius 0.25s,
        background 0.2s;
}

/* Hover: expand + slight fill */
.cursor-ring--hover {
    width: 52px;
    height: 52px;
    background: rgba(255, 255, 255, 0.06);
}

/* Click: contract */
.cursor-ring--clicking {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.12);
}
</style>

<!-- Hide native cursor on pointer devices -->
<style>
@media (hover: hover) and (pointer: fine) {

    *,
    *::before,
    *::after {
        cursor: none !important;
    }
}
</style>