import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { Search, UserPlus, Check, Clock, Users } from 'lucide-react';
import './FriendSearch.css';

function FriendSearch() {
  const { searchUsers, sendFriendRequest, isFriend, hasPendingRequest } = useFriends();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery || searchQuery.length < 2) {
      alert('Please enter at least 2 characters to search');
      return;
    }

    setSearching(true);
    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      alert('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (username) => {
    setSending(username);
    try {
      await sendFriendRequest(username);
      alert(`Friend request sent to ${username}!`);
      // Refresh search to update button states
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      alert(err.message || 'Failed to send friend request');
    } finally {
      setSending(null);
    }
  };

  const getUserStatus = (user) => {
    if (isFriend(user.userId)) return 'friend';
    const pending = hasPendingRequest(user.userId);
    if (pending.sent) return 'sent';
    if (pending.received) return 'received';
    return 'none';
  };

  return (
    <div className="friend-search">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-group">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <button
          type="submit"
          className="search-button"
          disabled={searching || searchQuery.length < 2}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="search-results">
          <h3 className="results-title">
            Search Results ({searchResults.length})
          </h3>
          <div className="results-list">
            {searchResults.map(user => {
              const status = getUserStatus(user);
              return (
                <div key={user.userId} className="search-result-card">
                  <div className="result-info">
                    <div className="result-avatar">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} />
                      ) : (
                        <div className="result-avatar-placeholder">
                          {user.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="result-details">
                      <h4>{user.displayName}</h4>
                      <p>@{user.username}</p>
                      {user.friendsCount > 0 && (
                        <p className="result-friends">
                          <Users size={14} />
                          {user.friendsCount} {user.friendsCount === 1 ? 'friend' : 'friends'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="result-action">
                    {status === 'friend' ? (
                      <button className="result-btn friend-btn" disabled>
                        <Check size={18} />
                        Friends
                      </button>
                    ) : status === 'sent' ? (
                      <button className="result-btn pending-btn" disabled>
                        <Clock size={18} />
                        Pending
                      </button>
                    ) : status === 'received' ? (
                      <button className="result-btn received-btn" disabled>
                        <Clock size={18} />
                        Requested You
                      </button>
                    ) : (
                      <button
                        className="result-btn add-btn"
                        onClick={() => handleSendRequest(user.username)}
                        disabled={sending === user.username}
                      >
                        <UserPlus size={18} />
                        {sending === user.username ? 'Sending...' : 'Add Friend'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !searching && (
        <div className="no-results">
          <Users size={48} />
          <h3>No users found</h3>
          <p>Try searching with a different username</p>
        </div>
      )}

      {!searchQuery && (
        <div className="search-empty">
          <Search size={48} />
          <h3>Find Friends</h3>
          <p>Search for users by their username to send friend requests</p>
        </div>
      )}
    </div>
  );
}

export default FriendSearch;
