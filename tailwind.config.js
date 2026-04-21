/** @type {import('tailwindcss').Config} */
import animatePlugin from "tailwindcss-animate"
const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // MPIQ Brand Colors
        mpiq: {
          DEFAULT: "#33a852",
          hover: "#2d9944",
          light: "#dcfce7",
          dark: "#166534",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse": {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "pulse": 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    animatePlugin,
    // Scrollbar plugin for custom scrollbar styling
    function({ addUtilities }) {
      const scrollbarUtilities = {
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
        },
        '.scrollbar-track-gray-100': {
          '&::-webkit-scrollbar-track': {
            'background-color': '#f3f4f6',
            'border-radius': '4px',
          },
          'scrollbar-color': 'var(--scrollbar-thumb, #d1d5db) #f3f4f6',
        },
        '.scrollbar-thumb-gray-300': {
          '&::-webkit-scrollbar-thumb': {
            'background-color': '#d1d5db',
            'border-radius': '4px',
          },
          'scrollbar-color': '#d1d5db var(--scrollbar-track, #f3f4f6)',
        },
        '.scrollbar-thumb-gray-400': {
          '&::-webkit-scrollbar-thumb': {
            'background-color': '#9ca3af',
            'border-radius': '4px',
          },
          'scrollbar-color': '#9ca3af var(--scrollbar-track, #f3f4f6)',
        },
        '.hover\\:scrollbar-thumb-gray-400:hover': {
          '&::-webkit-scrollbar-thumb': {
            'background-color': '#9ca3af',
          },
          'scrollbar-color': '#9ca3af var(--scrollbar-track, #f3f4f6)',
        },
        '.scrollbar-thumb-mpiq': {
          '&::-webkit-scrollbar-thumb': {
            'background-color': '#33a852',
            'border-radius': '4px',
          },
          'scrollbar-color': '#33a852 var(--scrollbar-track, #f3f4f6)',
        },
      };
      addUtilities(scrollbarUtilities);
    },
  ],
}

export default config 