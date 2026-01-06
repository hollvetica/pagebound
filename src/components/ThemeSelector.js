import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeSelector.css';

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
            {availableThemes[themeKey].name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemeSelector;