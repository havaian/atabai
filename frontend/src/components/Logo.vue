<template>
    <div :class="[
        'logo-container relative transition-all duration-300 ease-in-out',
        containerClass,
        { 'cursor-pointer': clickable }
    ]" @click="handleClick">
        <!-- Default logo (visible by default, hidden on hover) -->
        <div class="default-logo flex items-center transition-opacity duration-300 ease-in-out">
            <img src="/images/icons/logo.svg" alt="ATABAI" :class="[
                'mr-2',
                logoSizeClass
            ]" />
            <div :class="[
                'font-bold text-primary',
                textSizeClass
            ]">
                ATABAI
            </div>
        </div>

        <!-- Animated logo (hidden by default, visible on hover) -->
        <div :class="[
            'animated-logo absolute flex items-center opacity-0 transition-opacity duration-300 ease-in-out',
            positionClass
        ]">
            <div :class="[
                'flex items-center justify-center mr-2',
                logoHeightClass
            ]">
                <div :class="[
                    'select-none logo-fancy logo-svg',
                    logoSvgClass
                ]"></div>
            </div>
            <div :class="[
                'flex items-center',
                logoHeightClass
            ]">
                <div :class="[
                    'select-none font-bold logo-fancy logo-text',
                    textAnimatedClass
                ]">
                    ATABAI
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    size: {
        type: String,
        default: 'medium', // 'small', 'medium', 'large', 'hero'
        validator: (value) => ['small', 'medium', 'large', 'hero'].includes(value)
    },
    clickable: {
        type: Boolean,
        default: false
    },
    containerClass: {
        type: String,
        default: ''
    }
})

const emit = defineEmits(['click'])

// Size configurations
const sizeConfig = {
    small: {
        logoSize: 'h-4 w-4',
        textSize: 'text-lg',
        logoHeight: 'h-4',
        logoSvg: 'w-4 h-4',
        textAnimated: 'text-lg'
    },
    medium: {
        logoSize: 'h-6 w-6',
        textSize: 'text-2xl',
        logoHeight: 'h-6',
        logoSvg: 'w-6 h-6',
        textAnimated: 'text-2xl'
    },
    large: {
        logoSize: 'h-8 w-8',
        textSize: 'text-2xl',
        logoHeight: 'h-8',
        logoSvg: 'w-8 h-8',
        textAnimated: 'text-2xl'
    },
    hero: {
        logoSize: 'h-16 w-16',
        textSize: 'text-4xl',
        logoHeight: 'h-16',
        logoSvg: 'w-16 h-16',
        textAnimated: 'text-4xl'
    }
}

// Computed classes based on size
const logoSizeClass = computed(() => sizeConfig[props.size].logoSize)
const textSizeClass = computed(() => sizeConfig[props.size].textSize)
const logoHeightClass = computed(() => sizeConfig[props.size].logoHeight)
const logoSvgClass = computed(() => sizeConfig[props.size].logoSvg)
const textAnimatedClass = computed(() => sizeConfig[props.size].textAnimated)

const positionClass = computed(() => {
    return 'top-1/2 left-0 transform -translate-y-1/2'
})

function handleClick() {
    if (props.clickable) {
        emit('click')
    }
}
</script>

<style scoped>
/* Hover effects */
.logo-container:hover .default-logo {
    opacity: 0;
}

.logo-container:hover .animated-logo {
    opacity: 1;
}

/* Fancy logo styling */
.logo-fancy {
    background: linear-gradient(135deg, #9500FF 0%, var(--primary) 50%, #9500FF 100%);
    background-size: 200% 200%;
    filter: drop-shadow(0 0 20px rgba(2, 132, 199, 0.6)) drop-shadow(0 0 40px rgba(2, 132, 199, 0.3));
    animation: logoGlow 3s ease-in-out infinite alternate, gradientShift 4s ease-in-out infinite;
}

/* Text-specific styling */
.logo-fancy.logo-text {
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    mix-blend-mode: difference;
}

/* SVG-specific styling */
.logo-fancy.logo-svg {
    -webkit-mask: url('/images/icons/logo.svg') no-repeat center;
    mask: url('/images/icons/logo.svg') no-repeat center;
    -webkit-mask-size: contain;
    mask-size: contain;
    color: transparent;
    mix-blend-mode: difference;
    background: linear-gradient(135deg, #9500FF 0%, var(--primary) 50%, #9500FF 100%);
    background-size: 200% 200%;
    filter: drop-shadow(0 0 20px rgba(2, 132, 199, 0.6)) drop-shadow(0 0 40px rgba(2, 132, 199, 0.3));
}

/* Animations */
@keyframes logoGlow {
    0% {
        filter: drop-shadow(0 0 20px rgba(2, 132, 199, 0.6)) drop-shadow(0 0 40px rgba(2, 132, 199, 0.3));
    }

    100% {
        filter: drop-shadow(0 0 30px rgba(2, 132, 199, 0.8)) drop-shadow(0 0 60px rgba(2, 132, 199, 0.5));
    }
}

@keyframes gradientShift {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
    .logo-fancy {
        animation: none;
    }
}
</style>