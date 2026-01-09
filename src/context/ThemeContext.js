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

export const ThemeProvider = ({ children }) => {
  // Get theme from localStorage or use default
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('pagebound-theme');
    return savedTheme || defaultTheme;
  });

  // Get the actual theme object
  const theme = themes[currentTheme];

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pagebound-theme', currentTheme);
    applyThemeToDocument(theme);
  }, [currentTheme, theme]);

  // Apply theme CSS variables to the document
  const applyThemeToDocument = (theme) => {
    const root = document.documentElement;
    
    // Apply all color variables (this handles primary, secondary, background, etc.)
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Apply font variables
    root.style.setProperty('--font-heading', theme.fonts.heading);
    root.style.setProperty('--font-body', theme.fonts.body);
    
    // Apply background pattern variables (NEW - for SVG patterns)
    root.style.setProperty('--background-pattern', theme.backgroundPattern);
    root.style.setProperty('--background-size', theme.backgroundSize);
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