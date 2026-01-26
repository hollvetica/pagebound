import React from 'react';
import './ActivityFeed.css';

function ActivityFeed({ activities, onSuggestSession }) {
  const renderActivity = (activity) => {
    switch(activity.type) {
      case 'started_reading':
        return (
          <div className="activity-content">
            <span className="activity-icon">📖</span>
            <div className="activity-text">
              <p>
                <strong>{activity.friend}</strong> started reading <em>{activity.book}</em>
              </p>
              {activity.mutual && (
                <button 
                  className="suggest-session-btn"
                  onClick={() => onSuggestSession && onSuggestSession(activity)}
                >
                  📚 Start a reading session together
                </button>
              )}
            </div>
          </div>
        );
      
      case 'added_to_wishlist':
        return (
          <div className="activity-content">
            <span className="activity-icon">⭐</span>
            <div className="activity-text">
              <p>
                <strong>{activity.friend}</strong> added <em>{activity.book}</em> to their wishlist
              </p>
              {activity.mutual && (
                <button 
                  className="suggest-session-btn"
                  onClick={() => onSuggestSession && onSuggestSession(activity)}
                >
                  📚 You both want to read this - start together?
                </button>
              )}
            </div>
          </div>
        );
      
      case 'completed_book':
        return (
          <div className="activity-content">
            <span className="activity-icon">✅</span>
            <div className="activity-text">
              <p>
                <strong>{activity.friend}</strong> finished <em>{activity.book}</em>
              </p>
            </div>
          </div>
        );
      
      case 'achievement':
        return (
          <div className="activity-content">
            <span className="activity-icon">🏆</span>
            <div className="activity-text">
              <p>
                <strong>{activity.friend}</strong> earned: {activity.achievement}
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="activity-feed">
      <h3>Friend Activity</h3>
      <div className="activity-list">
        {activities.map((activity) => (
          <div key={activity.id} className="activity-item">
            {renderActivity(activity)}
            <span className="activity-time">{activity.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityFeed;
