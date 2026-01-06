import React from 'react';
import './ActivityFeed.css';

function ActivityFeed({ activities }) {
  const renderActivity = (activity) => {
    switch(activity.type) {
      case 'started_reading':
        return (
          <div className="activity-content">
            <span className="activity-icon">📖</span>
            <p>
              <strong>{activity.friend}</strong> started reading <em>{activity.book}</em>
            </p>
          </div>
        );
      
      case 'added_to_wishlist':
        return (
          <div className="activity-content">
            <span className="activity-icon">⭐</span>
            <p>
              <strong>{activity.friend}</strong> added <em>{activity.book}</em> to their wishlist
              {activity.mutual && (
                <span className="mutual-tag">You have this too! Read it together?</span>
              )}
            </p>
          </div>
        );
      
      case 'completed_book':
        return (
          <div className="activity-content">
            <span className="activity-icon">✅</span>
            <p>
              <strong>{activity.friend}</strong> finished <em>{activity.book}</em>
            </p>
          </div>
        );
      
      case 'achievement':
        return (
          <div className="activity-content">
            <span className="activity-icon">🏆</span>
            <p>
              <strong>{activity.friend}</strong> earned: {activity.achievement}
            </p>
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