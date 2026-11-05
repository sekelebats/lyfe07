export default {
  content: [
    './scripts/**/*.js',
    './public/**/*.html',
  ],
  safelist: [
    // Class dinamis yang mungkin terlewat dari template literal
    { pattern: /(bg|text|border|from|to|via)-(primary|secondary|muted|accent|card|border|background|foreground)/ },
    { pattern: /(columns|gap|p|px|py|m|mb|mt|space)-/ },
    'columns-1','columns-2','columns-3','columns-4','columns-5',
    'sm:columns-2','md:columns-3','lg:columns-4','xl:columns-5',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}