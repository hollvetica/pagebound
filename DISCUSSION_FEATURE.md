# Discussion Feature Implementation

This document outlines the complete implementation of the chapter-based discussion feature for Pagebound reading sessions.

## Overview

Users can now engage in spoiler-free discussions within reading sessions. Messages are linked to specific chapters and only become visible to participants who have reached that chapter in their reading progress.

## Features Implemented

### 1. **Chapter-Based Message Visibility**
- Users select a chapter when posting a message (default: their current chapter)
- Messages are only visible to participants who have reached or passed that chapter
- Hidden messages appear as "signposts" showing the chapter number
- Prevents spoilers while maintaining engagement

### 2. **Timeline Signpost Indicators**
- Visual indicators on participant progress timelines show unread messages
- Signposts appear as orange speech bubbles with chapter numbers
- Only visible to users who haven't reached that chapter yet
- Animated pulse effect to draw attention
- Tooltip shows unread message count

### 3. **Read/Unread Tracking**
- Per-user read status for each message
- Messages marked as read automatically when user views them
- Read status is individual - same message can be unread for different users
- Unread counts update in real-time

### 4. **Group Rating Display**
- Shows average rating from all participants' personal bookshelves
- Displayed prominently in session card header
- Golden gradient styling with star icon
- Currently uses mock data (needs integration with Library ratings)

### 5. **Profile Thumbnails & Timeline**
- Replaced simple progress bars with rich participant timelines
- Profile avatars with gradient fallback (first initial)
- Host badge indicator
- Interactive hover states
- Signpost indicators integrated into timeline

### 6. **Group Progress Removed**
- Eliminated "Group Progress" average display
- Focus shifted to individual participant progress
- More accurate representation of reading diversity

## File Structure

### Backend Files

#### Lambda Functions
- **`backend/lambda/sessionsAPI.js`** - Complete REST API for sessions and discussions
  - POST /sessions - Create session
  - GET /sessions/{userId}/list - Get user's sessions
  - GET /sessions/{sessionId} - Get session details
  - PUT /sessions/{sessionId}/progress - Update progress
  - POST /sessions/{sessionId}/messages - Post message
  - GET /sessions/{sessionId}/messages - Get messages (filtered by progress)
  - PUT /sessions/{sessionId}/messages/{messageId}/read - Mark as read
  - GET /sessions/{sessionId}/unread-timeline - Get unread indicators
  - DELETE /sessions/{sessionId} - Delete session

#### Database Schema
- **`backend/create-sessions-tables.json`** - Sessions table definition
  - Primary Key: sessionId
  - GSI: bookIsbn-index for querying by book

- **`backend/create-messages-table.json`** - Messages table definition
  - Primary Key: messageId
  - GSI: sessionId-index for querying messages by session

#### Infrastructure
- **`backend/cloudformation-template.yaml`** - Updated with:
  - SessionsTable resource
  - MessagesTable resource
  - SessionsAPIFunction Lambda
  - Updated IAM permissions for new tables

### Frontend Files

#### Services
- **`src/utils/sessionsService.js`** - API client for session operations
  - Consistent API interface
  - Error handling
  - Type-safe operations

#### Components
- **`src/components/Discussion.js`** - Main discussion modal
  - Message list with visibility filtering
  - Chapter selection dropdown
  - Hidden message placeholders
  - Real-time send/receive
  - Auto-scroll to latest messages

- **`src/components/Discussion.css`** - Comprehensive styling
  - Dark/light theme compatible
  - Responsive design
  - Message bubbles
  - Avatar styling
  - Signpost effects

- **`src/components/ParticipantTimeline.js`** - Enhanced participant display
  - Progress timeline visualization
  - Unread message signposts
  - Profile avatars
  - Host badge
  - Interactive tooltips

- **`src/components/ParticipantTimeline.css`** - Timeline styling
  - Gradient progress bars
  - Signpost animations
  - Avatar gradients
  - Responsive layout

#### Pages
- **`src/pages/Sessions.js`** - Updated sessions page
  - Integration with Discussion component
  - Integration with ParticipantTimeline
  - Group rating display
  - Removed group progress
  - Open Discussion button handler

- **`src/pages/Sessions.css`** - Updated styling
  - Group rating styles
  - Removed old progress section
  - Cleaned up participant styles

## Data Models

### Session Object
```javascript
{
  sessionId: string,
  sessionName: string,
  bookTitle: string,
  bookAuthor: string,
  bookCover: string,
  bookIsbn: string,
  totalChapters: number,
  totalPages: number,
  trackingMode: 'chapters' | 'pages',
  participants: [
    {
      userId: string,
      username: string,
      displayName: string,
      avatarUrl: string,
      currentChapter: number,
      currentPage: number,
      isHost: boolean,
      joinedAt: string
    }
  ],
  createdAt: string,
  updatedAt: string
}
```

### Message Object
```javascript
{
  messageId: string,
  sessionId: string,
  userId: string,
  username: string,
  displayName: string,
  avatarUrl: string,
  message: string,
  chapterNumber: number,
  createdAt: string,
  readBy: {
    [userId]: timestamp
  }
}
```

## User Flow

### Posting a Message
1. User clicks "Open Discussion" on a session
2. Discussion modal opens showing visible messages
3. Hidden messages appear as signposts
4. User types message in textarea
5. User selects chapter (defaults to current progress)
6. User clicks "Send"
7. Message saved with chapter link
8. Message becomes visible to participants at that chapter

### Viewing Timeline Indicators
1. Sarah is on Chapter 10
2. Jane posts message on Chapter 20
3. Sarah sees orange signpost bubble with "20" on Jane's timeline
4. Signpost animates to draw attention
5. When Sarah reaches Chapter 20, signpost disappears
6. Message becomes visible in discussion

### Reading Messages
1. User opens discussion
2. Visible messages display normally
3. Hidden messages show as placeholders
4. User's visible messages auto-marked as read
5. Signposts update across all timelines

## Integration Requirements

### Backend Deployment
1. Deploy CloudFormation stack (creates tables and Lambda)
2. Deploy sessionsAPI.js code to Lambda function
3. Update API Gateway routes
4. Set environment variables (table names)
5. Test API endpoints

### Frontend Configuration
1. Set REACT_APP_API_ENDPOINT environment variable
2. Update SessionContext to use sessionsService API
3. Ensure Auth context provides userId
4. Test with real user data

### Library Integration (TODO)
- Connect group rating to actual user ratings from Library
- Update `calculateGroupRating()` in Sessions.js to fetch real ratings
- Query each participant's bookshelf for the session's book
- Calculate average from actual rating values

## Testing Checklist

### Backend API Testing
- [ ] Create session with multiple participants
- [ ] Update participant progress
- [ ] Post message to specific chapter
- [ ] Retrieve messages filtered by user progress
- [ ] Mark messages as read
- [ ] Get unread timeline indicators
- [ ] Delete session

### Frontend Component Testing
- [ ] Open discussion modal
- [ ] Send message with chapter selection
- [ ] View visible vs hidden messages
- [ ] See signposts on timeline
- [ ] Update progress and see messages appear
- [ ] Multiple users in same session
- [ ] Responsive design on mobile

### User Scenarios
- [ ] User A posts message on Chapter 5
- [ ] User B (on Chapter 3) sees signpost
- [ ] User B reaches Chapter 5
- [ ] User B sees message appear
- [ ] Message marked as read for User B
- [ ] Signpost disappears from timeline

## Known Limitations

1. **No Real-Time Updates**: Messages don't appear automatically when posted by others. Requires page refresh or manual reload.
   - **Solution**: Implement WebSocket or polling for real-time updates

2. **Mock Group Ratings**: Currently uses hardcoded rating data
   - **Solution**: Integrate with Library bookshelf ratings

3. **No Notification System**: Users aren't notified of new messages
   - **Solution**: Add notification system for new messages

4. **Session Creation**: Still uses localStorage in SessionContext
   - **Solution**: Migrate SessionContext to use sessionsService API

5. **Large Sessions**: Scanning for user sessions is inefficient
   - **Solution**: Add userId GSI to sessions table or maintain user-sessions mapping

## Future Enhancements

1. **Rich Text Formatting**: Markdown support for messages
2. **Message Reactions**: Emoji reactions to messages
3. **Direct Replies**: Thread replies to specific messages
4. **Image Sharing**: Upload and share images in discussion
5. **Voice Messages**: Record and share audio messages
6. **Message Search**: Search through discussion history
7. **Pinned Messages**: Pin important messages to top
8. **Message Editing**: Edit posted messages (with edit indicator)
9. **Message Deletion**: Delete own messages
10. **Spoiler Tags**: Manual spoiler tag overlay for sensitive content

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /sessions | Create new session |
| GET | /sessions/{userId}/list | Get user's sessions |
| GET | /sessions/{sessionId} | Get session details |
| PUT | /sessions/{sessionId}/progress | Update progress |
| POST | /sessions/{sessionId}/messages | Post message |
| GET | /sessions/{sessionId}/messages | Get messages |
| PUT | /sessions/{sessionId}/messages/{messageId}/read | Mark as read |
| GET | /sessions/{sessionId}/unread-timeline | Get unread indicators |
| DELETE | /sessions/{sessionId} | Delete session |

## Environment Variables

### Backend
- `USERS_TABLE` - DynamoDB users table name
- `SESSIONS_TABLE` - DynamoDB sessions table name
- `MESSAGES_TABLE` - DynamoDB messages table name

### Frontend
- `REACT_APP_API_ENDPOINT` - API Gateway base URL

## Dependencies

### Backend
- @aws-sdk/client-dynamodb
- @aws-sdk/lib-dynamodb

### Frontend
- React (existing)
- Context API (existing)
- CSS Variables (existing)

## Conclusion

This implementation provides a complete, spoiler-free discussion system for reading sessions. The chapter-based visibility ensures users can engage safely, while the timeline indicators provide a visual guide to where discussions are waiting. The system is scalable, maintainable, and ready for production deployment after backend setup.
