import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { Users, UserPlus, Mail, Link as LinkIcon } from 'lucide-react';
import FriendsList from '../components/FriendsList';
import FriendRequests from '../components/FriendRequests';
import FriendSearch from '../components/FriendSearch';
import InviteLink from '../components/InviteLink';
import './Friends.css';

function Friends({ onNavigateToFriendProfile }) {
  const { friendRequests } = useFriends();
  const [activeTab, setActiveTab] = useState('friends');

  const pendingRequestsCount = friendRequests.received?.length || 0;

  const tabs = [
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'requests', label: 'Requests', icon: Mail, badge: pendingRequestsCount },
    { id: 'search', label: 'Find Friends', icon: UserPlus },
    { id: 'invite', label: 'Invite', icon: LinkIcon }
  ];

  return (
    <div className="page friends-page">
      <div className="friends-header">
        <h1>Friends</h1>
      </div>

      <div className="friends-tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`friends-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="tab-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="friends-content">
        {activeTab === 'friends' && (
          <FriendsList onViewProfile={onNavigateToFriendProfile} />
        )}
        {activeTab === 'requests' && (
          <FriendRequests />
        )}
        {activeTab === 'search' && (
          <FriendSearch />
        )}
        {activeTab === 'invite' && (
          <InviteLink />
        )}
      </div>
    </div>
  );
}

export default Friends;
