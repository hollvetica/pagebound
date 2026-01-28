import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { Mail, Check, X, Clock } from 'lucide-react';
import './FriendRequests.css';

function FriendRequests() {
  const { friendRequests, acceptFriendRequest, rejectFriendRequest } = useFriends();
  const [processing, setProcessing] = useState(null);

  const handleAccept = async (fromUserId) => {
    setProcessing(fromUserId);
    try {
      await acceptFriendRequest(fromUserId);
    } catch (err) {
      alert('Failed to accept friend request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (fromUserId) => {
    setProcessing(fromUserId);
    try {
      await rejectFriendRequest(fromUserId);
    } catch (err) {
      alert('Failed to reject friend request');
    } finally {
      setProcessing(null);
    }
  };

  const receivedRequests = friendRequests.received || [];
  const sentRequests = friendRequests.sent || [];

  return (
    <div className="friend-requests">
      {/* Received Requests */}
      <div className="requests-section">
        <h3 className="requests-section-title">
          <Mail size={18} />
          Received Requests
          {receivedRequests.length > 0 && (
            <span className="requests-count">{receivedRequests.length}</span>
          )}
        </h3>

        {receivedRequests.length === 0 ? (
          <div className="requests-empty">
            <p>No pending friend requests</p>
          </div>
        ) : (
          <div className="requests-list">
            {receivedRequests.map(request => (
              <div key={request.fromUserId} className="request-card">
                <div className="request-info">
                  <div className="request-avatar">
                    {request.fromAvatarUrl ? (
                      <img src={request.fromAvatarUrl} alt={request.fromDisplayName} />
                    ) : (
                      <div className="request-avatar-placeholder">
                        {request.fromDisplayName?.charAt(0).toUpperCase() || 'F'}
                      </div>
                    )}
                  </div>
                  <div className="request-details">
                    <h4>{request.fromDisplayName}</h4>
                    <p>@{request.fromUsername}</p>
                    {request.message && (
                      <p className="request-message">{request.message}</p>
                    )}
                    <p className="request-time">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="request-actions">
                  <button
                    className="request-btn accept-btn"
                    onClick={() => handleAccept(request.fromUserId)}
                    disabled={processing === request.fromUserId}
                  >
                    <Check size={18} />
                    Accept
                  </button>
                  <button
                    className="request-btn reject-btn"
                    onClick={() => handleReject(request.fromUserId)}
                    disabled={processing === request.fromUserId}
                  >
                    <X size={18} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sent Requests */}
      <div className="requests-section">
        <h3 className="requests-section-title">
          <Clock size={18} />
          Sent Requests
          {sentRequests.length > 0 && (
            <span className="requests-count">{sentRequests.length}</span>
          )}
        </h3>

        {sentRequests.length === 0 ? (
          <div className="requests-empty">
            <p>No outgoing friend requests</p>
          </div>
        ) : (
          <div className="requests-list">
            {sentRequests.map(request => (
              <div key={request.toUserId} className="request-card sent">
                <div className="request-info">
                  <div className="request-avatar">
                    <div className="request-avatar-placeholder">
                      <Clock size={20} />
                    </div>
                  </div>
                  <div className="request-details">
                    <h4>Request sent</h4>
                    <p className="request-time">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="request-status">
                  <span className="status-badge pending">Pending</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FriendRequests;
