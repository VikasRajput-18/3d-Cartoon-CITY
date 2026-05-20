/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka One"','cursive'],
        body:    ['"Nunito"','sans-serif'],
      },
      colors: {
        night: { 950:'#07040F', 900:'#0F0A1E', 800:'#1A1035', 700:'#251848' },
        brand: { purple:'#7C3AED', pink:'#EC4899', amber:'#F59E0B', teal:'#14B8A6' }
      },
      boxShadow: {
        cartoon: '3px 3px 0 rgba(0,0,0,0.3)',
        glow:    '0 0 24px rgba(124,58,237,0.5)',
      },
      keyframes: {
        float:  { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-6px)' } },
        popIn:  { '0%':{ transform:'scale(0.4)', opacity:'0' }, '70%':{ transform:'scale(1.08)' }, '100%':{ transform:'scale(1)', opacity:'1' } },
        fadeUp: { '0%':{ opacity:'0', transform:'translateY(12px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        shimmer:{ '0%':{ backgroundPosition:'-200% center' }, '100%':{ backgroundPosition:'200% center' } },
        typewriter: { from:{ width:'0' }, to:{ width:'100%' } },
      },
      animation: {
        float:    'float 2.8s ease-in-out infinite',
        popIn:    'popIn 0.4s cubic-bezier(.36,.07,.19,.97) forwards',
        fadeUp:   'fadeUp 0.4s ease forwards',
        shimmer:  'shimmer 2.5s linear infinite',
      }
    }
  },
  plugins: []
}
