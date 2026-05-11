<template>
    <section class="cta-section">
        <div class="cta-inner">
            <div ref="cardRef" class="cta-card" :class="{ 'cta-card-dark': themeStore.isDark }">
                <canvas ref="canvasRef" class="cta-dots" aria-hidden="true"></canvas>
                <div class="cta-content">
                    <h2 class="cta-title">{{ $t('finalCta.title') }}</h2>
                    <p class="cta-subtitle">{{ $t('finalCta.subtitle') }}</p>
                    <button class="cta-btn" @click="$emit('bookDemo')">
                        {{ $t('finalCta.button') }}
                        <ArrowRightIcon class="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
import { useThemeStore } from '@/stores/theme'

defineEmits(['bookDemo'])
const themeStore = useThemeStore()

const cardRef = ref(null)
const canvasRef = ref(null)

// Animation state — kept outside reactive system; refs would add Vue overhead on every frame
let ctx = null
let rafId = null
let dots = null          // Float32Array: [ax, ay, x, y, ax, ay, x, y, ...]
let dotCount = 0
let dpr = 1
let width = 0
let height = 0
let mouseX = -9999
let mouseY = -9999
let mouseInside = false
let idleFrames = 0       // counts frames where nothing moved — used to stop the RAF
let isAnimated = false   // false on touch / reduced-motion / small viewport

// Tuning constants
const GRID_SPACING = 32
const INFLUENCE_RADIUS = 130
const INFLUENCE_RADIUS_SQ = INFLUENCE_RADIUS * INFLUENCE_RADIUS
const MAX_DISPLACEMENT = 15
const RETURN_EASING = 0.08      // ~500ms to settle (1 - 0.08)^n ≈ 0 around frame 30
const IDLE_THRESHOLD = 30       // ~0.5s of no motion at 60fps → stop RAF

// Build the dot grid based on current size
function setupDots() {
    const cols = Math.ceil(width / GRID_SPACING)
    const rows = Math.ceil(height / GRID_SPACING)
    const offsetX = (width - (cols - 1) * GRID_SPACING) / 2
    const offsetY = (height - (rows - 1) * GRID_SPACING) / 2

    dotCount = cols * rows
    dots = new Float32Array(dotCount * 4)
    let i = 0
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ax = offsetX + c * GRID_SPACING
            const ay = offsetY + r * GRID_SPACING
            dots[i++] = ax  // anchor x
            dots[i++] = ay  // anchor y
            dots[i++] = ax  // current x
            dots[i++] = ay  // current y
        }
    }
}

// Resize handler — accounts for device pixel ratio (capped at 2 for perf)
function resize() {
    if (!canvasRef.value || !cardRef.value) return
    const rect = cardRef.value.getBoundingClientRect()
    width = rect.width
    height = rect.height
    dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvasRef.value.width = width * dpr
    canvasRef.value.height = height * dpr
    canvasRef.value.style.width = width + 'px'
    canvasRef.value.style.height = height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    setupDots()
    drawFrame()  // immediate paint so the user never sees an empty card
}

// Single frame draw — batched into one path for GPU efficiency
function drawFrame() {
    ctx.clearRect(0, 0, width, height)

    // Dark theme dots subtler against the darker gradient
    const dotColor = themeStore.isDark
        ? 'rgba(255, 255, 255, 0.13)'
        : 'rgba(255, 255, 255, 0.20)'

    ctx.fillStyle = dotColor
    ctx.beginPath()
    for (let i = 0; i < dotCount * 4; i += 4) {
        ctx.moveTo(dots[i + 2] + 1.4, dots[i + 3])
        ctx.arc(dots[i + 2], dots[i + 3], 1.4, 0, Math.PI * 2)
    }
    ctx.fill()
}

// Frame step — physics + draw
function tick() {
    let anyMotion = false

    for (let i = 0; i < dotCount * 4; i += 4) {
        const ax = dots[i]
        const ay = dots[i + 1]
        let x = dots[i + 2]
        let y = dots[i + 3]

        if (mouseInside) {
            const dx = x - mouseX
            const dy = y - mouseY
            const distSq = dx * dx + dy * dy

            if (distSq < INFLUENCE_RADIUS_SQ && distSq > 0.01) {
                // Repulsion force inversely proportional to distance; sqrt only when needed
                const dist = Math.sqrt(distSq)
                const force = (1 - dist / INFLUENCE_RADIUS) * MAX_DISPLACEMENT
                const targetX = ax + (dx / dist) * force
                const targetY = ay + (dy / dist) * force
                x += (targetX - x) * RETURN_EASING * 2  // approach displaced target faster than the return
                y += (targetY - y) * RETURN_EASING * 2
                anyMotion = true
            } else {
                // Outside influence — ease back to anchor
                x += (ax - x) * RETURN_EASING
                y += (ay - y) * RETURN_EASING
                if (Math.abs(ax - x) > 0.05 || Math.abs(ay - y) > 0.05) anyMotion = true
            }
        } else {
            // Cursor left the card — ease everything back home
            x += (ax - x) * RETURN_EASING
            y += (ay - y) * RETURN_EASING
            if (Math.abs(ax - x) > 0.05 || Math.abs(ay - y) > 0.05) anyMotion = true
        }

        dots[i + 2] = x
        dots[i + 3] = y
    }

    drawFrame()

    // Stop RAF once nothing's moving and cursor is gone — saves battery on idle pages
    if (anyMotion || mouseInside) {
        idleFrames = 0
        rafId = requestAnimationFrame(tick)
    } else if (++idleFrames < IDLE_THRESHOLD) {
        rafId = requestAnimationFrame(tick)
    } else {
        rafId = null
    }
}

function ensureRunning() {
    if (rafId === null && isAnimated) {
        idleFrames = 0
        rafId = requestAnimationFrame(tick)
    }
}

function onMouseMove(e) {
    const rect = cardRef.value.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
    mouseInside = true
    ensureRunning()
}

function onMouseLeave() {
    mouseInside = false
    mouseX = -9999
    mouseY = -9999
    ensureRunning()
}

let resizeObserver = null

onMounted(() => {
    if (!canvasRef.value || !cardRef.value) return

    ctx = canvasRef.value.getContext('2d', { alpha: true })
    if (!ctx) return

    // Decide whether to animate — touch devices, reduced-motion, narrow viewport → static
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hasHover = window.matchMedia('(hover: hover)').matches
    const wideEnough = window.innerWidth >= 768
    isAnimated = !reducedMotion && hasHover && wideEnough

    resize()

    if (isAnimated) {
        cardRef.value.addEventListener('mousemove', onMouseMove, { passive: true })
        cardRef.value.addEventListener('mouseleave', onMouseLeave, { passive: true })
    }

    resizeObserver = new ResizeObserver(() => {
        resize()
        // Single redraw is enough — if cursor's outside, no further frames needed
    })
    resizeObserver.observe(cardRef.value)
})

onBeforeUnmount(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (cardRef.value && isAnimated) {
        cardRef.value.removeEventListener('mousemove', onMouseMove)
        cardRef.value.removeEventListener('mouseleave', onMouseLeave)
    }
    if (resizeObserver) resizeObserver.disconnect()
    dots = null
    ctx = null
})
</script>

<style scoped>
.cta-section {
    padding: 2rem 1.5rem 6rem;
}

.cta-inner {
    max-width: 960px;
    margin: 0 auto;
}

.cta-card {
    position: relative;
    border-radius: 24px;
    padding: 4rem 2rem;
    text-align: center;
    overflow: hidden;
    background: linear-gradient(135deg, #9500FF 0%, #7C3AED 40%, #5B21B6 100%);
}

.cta-card-dark {
    background: linear-gradient(135deg, #4A007A 0%, #3B1A7A 40%, #2D1560 100%);
}

.cta-dots {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

.cta-content {
    position: relative;
    z-index: 2;
}

.cta-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: white;
    margin-bottom: 1rem;
    line-height: 1.1;
}

.cta-subtitle {
    font-size: clamp(.95rem, 2vw, 1.1rem);
    color: rgba(255, 255, 255, 0.65);
    max-width: 480px;
    margin: 0 auto 2.5rem;
    line-height: 1.6;
}

.cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 36px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all .3s;
    border: none;
    background: white;
    color: #5B21B6;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.cta-btn:hover {
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
    .cta-section {
        padding: 0 4rem 2rem 4rem;
    }

    .cta-card {
        padding: 3rem 1.5rem;
        border-radius: 20px;
    }

    .cta-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>