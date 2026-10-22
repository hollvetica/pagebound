import React from 'react';
import { Home, BookOpen, Users, User, UserPlus } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import './BottomNav.css';

function BottomNav({ currentPage, onNavigate }) {
  // New comments + unopened session invitations
  const { notificationTotal } = useSession();

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: BookOpen },
    { id: 'sessions', label: 'Sessions', icon: Users, badge: notificationTotal },
    { id: 'friends', label: 'Friends', icon: UserPlus },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${currentPage === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-label={item.badge ? `${item.label}, ${item.badge} new` : item.label}
        >
          <item.icon size={24} />
          <span>{item.label}</span>
          {item.badge > 0 && (
            <span className="badge" aria-hidden="true">{item.badge > 9 ? '9+' : item.badge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

export default BottomNav;
