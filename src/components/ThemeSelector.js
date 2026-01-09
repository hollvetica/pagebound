import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeSelector.css';

// Theme icons mapping
const themeIcons = {
  fantasy: '🐉',
  romance: '💕',
  mystery: '🔍',
  scifi: '🚀',
  historical: '📜',
  horror: '💀',
  contemporary: '☕',
  youngAdult: '⭐'
};

function ThemeSelector() {
  const { currentTheme, changeTheme, availableThemes } = useTheme();

  return (
    <div className="theme-selector">
      <h3>Choose Your Reading Vibe</h3>
      <div className="theme-options">
        {Object.keys(availableThemes).map((themeKey) => (
          <button
            key={themeKey}
            className={`theme-option ${currentTheme === themeKey ? 'active' : ''}`}
            onClick={() => changeTheme(themeKey)}
          >
            <span className="theme-icon">{themeIcons[themeKey] || '📚'}</span>
            <span className="theme-name">{availableThemes[themeKey].name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemeSelector;