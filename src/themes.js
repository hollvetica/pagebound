export const themes = {
  fantasy: {
    name: 'Fantasy',
    colors: {
      primary: '#6B4E9C',      // Deep purple
      secondary: '#D4AF37',     // Gold
      background: '#1A1325',    // Dark mystical purple
      surface: '#2D1B3D',       // Lighter purple
      text: '#F5F5DC',          // Beige/parchment
      accent: '#9B59B6',        // Bright purple
      border: '#D4AF37'         // Gold border
    },
    fonts: {
      heading: "'Cinzel', serif",
      body: "'Lora', serif"
    },
    backgroundImage: '/themes/fantasy-bg.png',  // Path to your custom background
    backgroundOverlay: 'rgba(26, 19, 37, 0.85)' // Semi-transparent overlay for readability
  },
  
  horror: {
    name: 'Horror',
    colors: {
      primary: '#8B0000',       // Dark red
      secondary: '#2C2C2C',     // Charcoal
      background: '#0D0D0D',    // Near black
      surface: '#1A1A1A',       // Dark gray
      text: '#E8E8E8',          // Off-white
      accent: '#FF4444',        // Blood red
      border: '#4A0404'         // Dark red border
    },
    fonts: {
      heading: "'Creepster', cursive",
      body: "'Merriweather', serif"
    },
    backgroundImage: '/themes/horror-bg.png',
    backgroundOverlay: 'rgba(13, 13, 13, 0.9)'
  },
  
  mystery: {
    name: 'Mystery',
    colors: {
      primary: '#1B4965',       // Deep blue
      secondary: '#CAE9FF',     // Light blue
      background: '#0F1B2E',    // Dark navy
      surface: '#1E2D3D',       // Slate blue
      text: '#E6F1F5',          // Light blue-white
      accent: '#5FA8D3',        // Medium blue
      border: '#62B6CB'         // Cyan border
    },
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Crimson Text', serif"
    },
    backgroundImage: '/themes/mystery-bg.png',
    backgroundOverlay: 'rgba(15, 27, 46, 0.85)'
  },
  
  historicalNonFiction: {
    name: 'Historical Non-Fiction',
    colors: {
      primary: '#8B4513',       // Saddle brown
      secondary: '#D2B48C',     // Tan
      background: '#2B1810',    // Dark brown
      surface: '#3D2817',       // Warm brown
      text: '#F4EDD8',          // Cream
      accent: '#CD853F',        // Peru/tan
      border: '#A0826D'         // Light brown border
    },
    fonts: {
      heading: "'EB Garamond', serif",
      body: "'Libre Baskerville', serif"
    },
    backgroundImage: '/themes/historical-bg.png',
    backgroundOverlay: 'rgba(43, 24, 16, 0.88)'
  }
};

export const defaultTheme = 'fantasy';