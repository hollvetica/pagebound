export const themes = {
  fantasy: {
    name: 'Fantasy',
    colors: {
      primary: '#7c3aed',
      primaryDark: '#5b21b6',
      secondary: '#d97706',
      background: '#18181b',
      surface: '#27272a',
      cardBg: '#27272a',
      text: '#e4e4e7',
      textSecondary: '#a1a1aa',
      accent: '#fbbf24',
      border: '#3f3f46',
      progressBg: '#3f3f46'
    },
    fonts: {
      heading: "'Cinzel', serif",
      body: "'Lora', serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><path d="M10 10 L15 5 L20 10 L25 8 L30 15 L25 20 L20 18 L15 22 L12 18 L8 20 L6 15 Z" fill="black"/><circle cx="17" cy="12" r="2" fill="black"/><path d="M28 18 L38 16 L35 22 Z" fill="black"/><path d="M8 18 L5 25 L12 23 Z" fill="black"/></svg>')`,
    backgroundSize: '80px 80px'
  },
  
  romance: {
    name: 'Romance',
    colors: {
      primary: '#ec4899',
      primaryDark: '#db2777',
      secondary: '#f472b6',
      background: '#fdf2f8',
      surface: '#fce7f3',
      cardBg: '#fae8f3',
      text: '#9f1239',
      textSecondary: '#be123c',
      accent: '#fb7185',
      border: '#f9a8d4',
      progressBg: '#f0d9e3'
    },
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Lora', serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="M30 45 L20 30 Q20 20 30 20 Q40 20 40 30 Z M30 45 L40 30 Q40 20 30 20 Q20 20 20 30 Z" fill="black"/></svg>')`,
    backgroundSize: '60px 60px'
  },
  
  mystery: {
    name: 'Mystery',
    colors: {
      primary: '#d97706',
      primaryDark: '#b45309',
      secondary: '#78716c',
      background: '#1c1917',
      surface: '#292524',
      cardBg: '#292524',
      text: '#fafaf9',
      textSecondary: '#d6d3d1',
      accent: '#fbbf24',
      border: '#44403c',
      progressBg: '#44403c'
    },
    fonts: {
      heading: "'Playfair Display', serif",
      body: "'Crimson Text', serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path d="M24 0 L48 24 L24 48 L0 24 Z" fill="none" stroke="black" stroke-width="3"/><path d="M24 12 L36 24 L24 36 L12 24 Z" fill="black"/></svg>')`,
    backgroundSize: '48px 48px'
  },
  
  scifi: {
    name: 'Sci-Fi',
    colors: {
      primary: '#06b6d4',
      primaryDark: '#0891b2',
      secondary: '#3b82f6',
      background: '#020617',
      surface: '#0f172a',
      cardBg: '#0f172a',
      text: '#e0f2fe',
      textSecondary: '#7dd3fc',
      accent: '#22d3ee',
      border: '#1e293b',
      progressBg: '#1e293b'
    },
    fonts: {
      heading: "'Orbitron', sans-serif",
      body: "'Inter', sans-serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><line x1="0" y1="24" x2="48" y2="24" stroke="black" stroke-width="2"/><line x1="24" y1="0" x2="24" y2="48" stroke="black" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="black"/></svg>')`,
    backgroundSize: '48px 48px'
  },
  
  historical: {
    name: 'Historical',
    colors: {
      primary: '#8b6f47',
      primaryDark: '#6d5638',
      secondary: '#a0826d',
      background: '#f5f1e8',
      surface: '#ede7dc',
      cardBg: '#f0ead9',
      text: '#3d3026',
      textSecondary: '#6b5d4f',
      accent: '#9c7a54',
      border: '#d4c5ab',
      progressBg: '#ddd5c5'
    },
    fonts: {
      heading: "'EB Garamond', serif",
      body: "'Libre Baskerville', serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="32"><line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-width="2"/></svg>')`,
    backgroundSize: '100% 32px'
  },
  
  horror: {
    name: 'Horror',
    colors: {
      primary: '#8b3a3a',
      primaryDark: '#6b2828',
      secondary: '#4a4a4a',
      background: '#1a1414',
      surface: '#251e1e',
      cardBg: '#251e1e',
      text: '#d4caca',
      textSecondary: '#a89090',
      accent: '#9d4444',
      border: '#352a2a',
      progressBg: '#352a2a'
    },
    fonts: {
      heading: "'Creepster', cursive",
      body: "'Merriweather', serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><ellipse cx="15" cy="12" rx="6" ry="10" fill="black"/><circle cx="15" cy="22" r="8" fill="black"/><ellipse cx="50" cy="18" rx="4" ry="6" fill="black"/><circle cx="50" cy="25" r="5" fill="black"/></svg>')`,
    backgroundSize: '80px 80px'
  },
  
  contemporary: {
    name: 'Contemporary',
    colors: {
      primary: '#0891b2',
      primaryDark: '#0e7490',
      secondary: '#06b6d4',
      background: '#f8fafc',
      surface: '#ffffff',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      accent: '#22d3ee',
      border: '#e2e8f0',
      progressBg: '#e2e8f0'
    },
    fonts: {
      heading: "'Inter', sans-serif",
      body: "'Inter', sans-serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="3" fill="black"/></svg>')`,
    backgroundSize: '48px 48px'
  },
  
  youngAdult: {
    name: 'Young Adult',
    colors: {
      primary: '#f59e0b',
      primaryDark: '#d97706',
      secondary: '#a855f7',
      background: '#fef3c7',
      surface: '#fefce8',
      cardBg: '#fefce8',
      text: '#78350f',
      textSecondary: '#92400e',
      accent: '#84cc16',
      border: '#fde68a',
      progressBg: '#fde68a'
    },
    fonts: {
      heading: "'Poppins', sans-serif",
      body: "'Inter', sans-serif"
    },
    backgroundPattern: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><polygon points="12,8 14,12 10,12" fill="black"/><polygon points="12,16 14,12 10,12" fill="black"/><polygon points="8,12 12,10 12,14" fill="black"/><polygon points="16,12 12,10 12,14" fill="black"/><circle cx="12" cy="12" r="2" fill="black"/><polygon points="50,38 52,42 48,42" fill="black"/><polygon points="50,46 52,42 48,42" fill="black"/><polygon points="46,42 50,40 50,44" fill="black"/><polygon points="54,42 50,40 50,44" fill="black"/><circle cx="50" cy="42" r="2" fill="black"/></svg>')`,
    backgroundSize: '80px 80px'
  }
};

export const defaultTheme = 'fantasy';
