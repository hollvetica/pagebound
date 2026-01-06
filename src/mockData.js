// Mock data for development - will be replaced with real data later

export const mockUser = {
  name: 'Hollie',
  friendCount: 12
};

export const mockActiveSessions = [
  {
    id: 1,
    book: {
      title: 'The Night Circus',
      author: 'Erin Morgenstern',
      coverUrl: null // We'll add covers later
    },
    friends: ['Sarah', 'Maya'],
    currentChapter: 8,
    totalChapters: 15,
    lastActivity: '2 hours ago'
  },
  {
    id: 2,
    book: {
      title: 'Mexican Gothic',
      author: 'Silvia Moreno-Garcia',
      coverUrl: null
    },
    friends: ['Alex'],
    currentChapter: 3,
    totalChapters: 12,
    lastActivity: 'Yesterday'
  }
];

export const mockActivityFeed = [
  {
    id: 1,
    type: 'started_reading',
    friend: 'Sarah',
    book: 'The Shadow of the Wind',
    timestamp: '1 hour ago'
  },
  {
    id: 2,
    type: 'added_to_wishlist',
    friend: 'Jane',
    book: 'Project Hail Mary',
    timestamp: '3 hours ago',
    mutual: true // You also have this book
  },
  {
    id: 3,
    type: 'completed_book',
    friend: 'Maya',
    book: 'The Night Circus',
    timestamp: '5 hours ago'
  },
  {
    id: 4,
    type: 'achievement',
    friend: 'Alex',
    achievement: 'Read 5 books this month',
    timestamp: 'Yesterday'
  },
  {
    id: 5,
    type: 'added_to_wishlist',
    friend: 'Carlos',
    book: 'The Priory of the Orange Tree',
    timestamp: 'Yesterday',
    mutual: true
  }
];