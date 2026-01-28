import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as friendsService from '../utils/friendsService';

const FriendsContext = createContext();

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within a FriendsProvider');
  }
  return context;
};

export const FriendsProvider = ({ children }) => {
  const { userProfile } = useAuth();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userId = userProfile?.userId;

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await friendsService.getFriendsList(userId);
      setFriends(data.friends || []);
    } catch (err) {
      setError('Failed to load friends');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch friend requests
  const fetchFriendRequests = useCallback(async () => {
    if (!userId) return;

    try {
      const data = await friendsService.getFriendRequests(userId);
      setFriendRequests(data);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
    }
  }, [userId]);

  // Send friend request
  const sendFriendRequest = async (toUsername, message = '') => {
    if (!userId) throw new Error('User not authenticated');

    setError(null);
    try {
      await friendsService.sendFriendRequest(userId, toUsername, message);
      // Refresh requests to show in sent list
      await fetchFriendRequests();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Accept friend request
  const acceptFriendRequest = async (fromUserId) => {
    if (!userId) throw new Error('User not authenticated');

    setError(null);
    try {
      await friendsService.respondToFriendRequest(userId, fromUserId, 'accept');
      // Refresh both friends and requests
      await Promise.all([fetchFriends(), fetchFriendRequests()]);
      return { success: true };
    } catch (err) {
      setError('Failed to accept friend request');
      throw err;
    }
  };

  // Reject friend request
  const rejectFriendRequest = async (fromUserId) => {
    if (!userId) throw new Error('User not authenticated');

    setError(null);
    try {
      await friendsService.respondToFriendRequest(userId, fromUserId, 'reject');
      // Refresh requests
      await fetchFriendRequests();
      return { success: true };
    } catch (err) {
      setError('Failed to reject friend request');
      throw err;
    }
  };

  // Remove friend
  const removeFriend = async (friendUserId) => {
    if (!userId) throw new Error('User not authenticated');

    setError(null);
    try {
      await friendsService.removeFriend(userId, friendUserId);
      // Refresh friends list
      await fetchFriends();
      return { success: true };
    } catch (err) {
      setError('Failed to remove friend');
      throw err;
    }
  };

  // Search users
  const searchUsers = async (searchQuery) => {
    if (!userId) throw new Error('User not authenticated');
    if (!searchQuery || searchQuery.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    try {
      const data = await friendsService.searchUsers(userId, searchQuery);
      return data.users || [];
    } catch (err) {
      console.error('Failed to search users:', err);
      return [];
    }
  };

  // Create invite link
  const createInviteLink = async (expiresInDays = null, maxUses = null) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const data = await friendsService.createInviteLink(userId, expiresInDays, maxUses);
      return data;
    } catch (err) {
      setError('Failed to create invite link');
      throw err;
    }
  };

  // Get invite info
  const getInviteInfo = async (inviteCode) => {
    if (!userId) throw new Error('User not authenticated');

    try {
      const data = await friendsService.getInviteInfo(userId, inviteCode);
      return data;
    } catch (err) {
      console.error('Failed to get invite info:', err);
      throw err;
    }
  };

  // Check if a user is a friend
  const isFriend = (friendUserId) => {
    return friends.some(friend => friend.friendUserId === friendUserId);
  };

  // Check if there's a pending request to/from a user
  const hasPendingRequest = (otherUserId) => {
    const sentRequest = friendRequests.sent.some(req => req.toUserId === otherUserId);
    const receivedRequest = friendRequests.received.some(req => req.fromUserId === otherUserId);
    return { sent: sentRequest, received: receivedRequest };
  };

  // Get friend by userId
  const getFriendByUserId = (friendUserId) => {
    return friends.find(friend => friend.friendUserId === friendUserId);
  };

  // Load friends and requests when user logs in
  useEffect(() => {
    if (userId) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [userId, fetchFriends, fetchFriendRequests]);

  return (
    <FriendsContext.Provider value={{
      friends,
      friendRequests,
      loading,
      error,
      fetchFriends,
      fetchFriendRequests,
      sendFriendRequest,
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
      searchUsers,
      createInviteLink,
      getInviteInfo,
      isFriend,
      hasPendingRequest,
      getFriendByUserId
    }}>
      {children}
    </FriendsContext.Provider>
  );
};
