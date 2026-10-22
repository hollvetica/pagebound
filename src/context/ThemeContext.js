import React, { createContext, useState, useContext, useEffect } from 'react';
import { themes, defaultTheme } from '../themes';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// textSecondary -> text-secondary
const toKebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const ThemeProvider = ({ children }) => {
  // Get theme from localStorage or use default. A saved theme that no longer
  // exists (e.g. one of the retired genre themes) falls back to the default.
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('pagebound-theme');
    return themes[savedTheme] ? savedTheme : defaultTheme;
  });

  // Get the actual theme object
  const theme = themes[currentTheme];

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pagebound-theme', currentTheme);
    applyThemeToDocument(theme);
  }, [currentTheme, theme]);

  // Apply theme tokens to the document as CSS variables
  const applyThemeToDocument = (theme) => {
    const root = document.documentElement;

    // colors.textSecondary -> --color-text-secondary
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${toKebab(key)}`, value);
    });

    root.style.setProperty('--font-heading', theme.fonts.heading);
    root.style.setProperty('--font-body', theme.fonts.body);

    // Optional structural overrides, e.g. { 'radius-md': '10px' }
    Object.entries(theme.tokens || {}).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', theme.colors.background);
    }
  };

  const changeTheme = (themeName) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, changeTheme, availableThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
};
