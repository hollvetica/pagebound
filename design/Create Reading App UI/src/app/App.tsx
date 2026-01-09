import { useState } from "react";
import { ReadingSessionCard, ReadingSession } from "./components/ReadingSessionCard";
import {
  Home,
  BookOpen,
  Users,
  Settings,
  Palette,
  Sparkles,
  Heart,
  Search,
  Rocket,
  Scroll,
  Skull,
  Coffee,
  Star,
} from "lucide-react";
import "./styles.css";

const GENRES = [
  { id: "fantasy", name: "Fantasy", icon: Sparkles },
  { id: "romance", name: "Romance", icon: Heart },
  { id: "mystery", name: "Mystery", icon: Search },
  { id: "scifi", name: "Sci-Fi", icon: Rocket },
  { id: "historical", name: "Historical", icon: Scroll },
  { id: "horror", name: "Horror", icon: Skull },
  { id: "contemporary", name: "Contemporary", icon: Coffee },
  { id: "ya", name: "Young Adult", icon: Star },
];

const mockSessions: ReadingSession[] = [
  {
    id: "1",
    bookTitle: "The Dragon's Legacy",
    bookCover: "https://images.unsplash.com/photo-1711185892790-4cabb6701cb8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwYm9vayUyMGNvdmVyfGVufDF8fHx8MTc2Nzg4NTU2MHww&ixlib=rb-4.1.0&q=80&w=400",
    progress: 67,
    currentPage: 234,
    currentChapter: 12,
    participants: [
      {
        name: "You",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 72,
        isUser: true,
      },
      {
        name: "John",
        avatar: "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 62,
      },
    ],
    duration: "2h 34m",
    messageCount: 5,
  },
  {
    id: "2",
    bookTitle: "Midnight Secrets",
    bookCover: "https://images.unsplash.com/photo-1604435062356-a880b007922c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    progress: 42,
    currentPage: 156,
    currentChapter: 8,
    participants: [
      {
        name: "You",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 55,
        isUser: true,
      },
      {
        name: "Alex",
        avatar: "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 29,
      },
      {
        name: "Mia",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 48,
      },
    ],
    duration: "1h 18m",
    messageCount: 12,
  },
  {
    id: "3",
    bookTitle: "Stars Beyond",
    bookCover: "https://images.unsplash.com/photo-1748712576539-d40bab99b1e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400",
    progress: 89,
    currentPage: 412,
    currentChapter: 23,
    participants: [
      {
        name: "You",
        avatar: "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 94,
        isUser: true,
      },
      {
        name: "Lisa",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 84,
      },
      {
        name: "Dave",
        avatar: "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 91,
      },
      {
        name: "Kate",
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=100",
        progress: 87,
      },
    ],
    duration: "3h 45m",
    messageCount: 0,
  },
];

export default function App() {
  const [currentGenre, setCurrentGenre] = useState("fantasy");
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  return (
    <div className={`app-container theme-${currentGenre}`}>
      <header className="app-header">
        <h1>Pagebound</h1>
        <button
          className="theme-selector-btn"
          onClick={() => setShowThemeSelector(!showThemeSelector)}
        >
          <Palette size={20} />
        </button>
      </header>

      {showThemeSelector && (
        <div className="theme-selector">
          <h3>Choose Your Reading Theme</h3>
          <div className="theme-grid">
            {GENRES.map((genre) => (
              <button
                key={genre.id}
                className={`theme-btn ${currentGenre === genre.id ? "active" : ""}`}
                onClick={() => {
                  setCurrentGenre(genre.id);
                  setShowThemeSelector(false);
                }}
              >
                <genre.icon className="theme-icon" size={32} />
                <span className="theme-name">{genre.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="sessions-header">
          <h2>Active Reading Sessions</h2>
          <span className="session-count">{mockSessions.length} sessions</span>
        </div>

        <div className="sessions-list">
          {mockSessions.map((session) => (
            <ReadingSessionCard key={session.id} session={session} />
          ))}
        </div>
      </main>

      <footer className="app-footer">
        <button className="nav-btn active">
          <Home size={24} />
          <span>Home</span>
        </button>
        <button className="nav-btn">
          <BookOpen size={24} />
          <span>Library</span>
        </button>
        <button className="nav-btn">
          <Users size={24} />
          <span>Friends</span>
        </button>
        <button className="nav-btn">
          <Settings size={24} />
          <span>Settings</span>
        </button>
      </footer>
    </div>
  );
}