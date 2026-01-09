import { MessageCircle, Gamepad2, Clock } from "lucide-react";

export interface ReadingSession {
  id: string;
  bookTitle: string;
  bookCover: string;
  progress: number;
  currentPage: number;
  currentChapter: number;
  participants: {
    name: string;
    avatar: string;
    progress: number;
    isUser?: boolean;
  }[];
  duration: string;
  messageCount: number;
}

interface ReadingSessionCardProps {
  session: ReadingSession;
}

export function ReadingSessionCard({ session }: ReadingSessionCardProps) {
  return (
    <div className="session-card">
      <div className="session-header">
        <div className="book-cover">
          <img src={session.bookCover} alt={session.bookTitle} />
        </div>
        <div className="book-info">
          <h3 className="book-title">{session.bookTitle}</h3>
          <div className="session-duration">
            <Clock size={16} />
            <span>{session.duration}</span>
          </div>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-container">
          {/* User 1 - Above */}
          <div className="avatar-above" style={{ left: `${session.participants[0].progress}%` }}>
            <div className="avatar">
              <img src={session.participants[0].avatar} alt={session.participants[0].name} />
            </div>
            <div className="line-down" />
          </div>
          
          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${session.progress}%` }} />
          </div>
          
          {/* User 2 - Below */}
          {session.participants[1] && (
            <div className="avatar-below" style={{ left: `${session.participants[1].progress}%` }}>
              <div className="line-up" />
              <div className="avatar">
                <img src={session.participants[1].avatar} alt={session.participants[1].name} />
              </div>
            </div>
          )}
        </div>
        
        <span className="progress-text">{session.progress}% Average Progress</span>
      </div>

      <div className="session-actions">
        <button className="action-btn messages-btn">
          <MessageCircle size={18} />
          <span>Messages</span>
          {session.messageCount > 0 && (
            <span className="badge">{session.messageCount}</span>
          )}
        </button>
        <button className="action-btn challenge-btn">
          <Gamepad2 size={18} />
          <span>Challenge</span>
        </button>
      </div>
    </div>
  );
}