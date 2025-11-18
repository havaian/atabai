/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#65399a',
          light: '#8b7ed8',
          dark: '#5d4a9e',
        },
        secondary: {
          DEFAULT: '#10B981',
          light: '#34d399',
          dark: '#059669',
        },
        accent: '#65399a',
        'atabai-violet': '#9500FF',
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          500: '#6B7280',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '5xl': '3rem',
        '68px': '68px',
        '44px': '44px',
        '40px': '40px',
        '32px': '32px',
        '20px': '20px',
        '16px': '16px',
        '15px': '15px',
        '14px': '14px',
        '12px': '12px',
      },
      lineHeight: {
        '68px': '68px',
        '56px': '56px',
        '52px': '52px',
        '28px': '28px',
        '24px': '24px',
        '20px': '20px',
        '100%': '100%',
        '112%': '112%',
        '120%': '120%',
        'tight': '1.25',
        'none': '1',
      },
      letterSpacing: {
        '-0.88px': '-0.88px',
        '-0.48px': '-0.48px',
        '-0.4px': '-0.4px',
        '-0.36px': '-0.36px',
        '-0.32px': '-0.32px',
        '-0.2px': '-0.2px',
        '-0.02em': '-0.02em',
      },
      borderRadius: {
        '5px': '5px',
        '8px': '8px',
        '14px': '14px',
        '18px': '18px',
        '20px': '20px',
        '32px': '32px',
        '40px': '40px',
        '47px': '47px',
        '50%': '50%',
      },
      spacing: {
        '53px': '53px',
        '52px': '52px',
        '60px': '60px',
        '85px': '85px',
        '100px': '100px',
        '108px': '108px',
        '138px': '138px',
        '146px': '146px',
        '150px': '150px',
        '154px': '154px',
        '162px': '162px',
        '168px': '168px',
        '200px': '200px',
        '215px': '215px',
        '260px': '260px',
        '270px': '270px',
        '280px': '280px',
        '300px': '300px',
        '317px': '317px',
        '330px': '330px',
        '367px': '367px',
        '379px': '379px',
        '389px': '389px',
        '400px': '400px',
        '420px': '420px',
        '580px': '580px',
        '765px': '765px',
        '795px': '795px',
        '800px': '800px',
        '980px': '980px',
      },
      minHeight: {
        '50px': '50px',
        '60px': '60px',
        '64px': '64px',
        '93px': '93px',
        '146px': '146px',
        '150px': '150px',
        '200px': '200px',
      },
      maxWidth: {
        '250px': '250px',
        '330px': '330px',
        '379px': '379px',
        '580px': '580px',
        '765px': '765px',
        '795px': '795px',
        '800px': '800px',
        '980px': '980px',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        ping: {
          '75%, 100%': {
            transform: 'scale(2)',
            opacity: '0'
          }
        },
        pulse: {
          '50%': {
            opacity: '0.5'
          }
        },
        spin: {
          '100%': {
            transform: 'rotate(360deg)'
          }
        }
      },
      boxShadow: {
        'atabai': '0 11px 33px 0 rgba(0, 0, 0, 0.08)',
        'atabai-lg': '0px 11px 33px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}