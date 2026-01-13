import React from 'react';
import { Home, BookOpen, Users, User } from 'lucide-react';
import './BottomNav.css';

function BottomNav({ currentPage, onNavigate }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'sessions', label: 'Sessions', icon: Users },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${currentPage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <item.icon size={24} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default BottomNav;