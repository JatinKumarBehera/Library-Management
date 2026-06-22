import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, LogIn, LogOut, Search, Plus, Trash2, Edit3, 
  Check, X, Star, Calendar, Sparkles, Filter, RefreshCw, 
  Library, Tag, Info, UserCheck, AlertCircle, Heart
} from 'lucide-react';
import { auth, db, handleFirestoreError } from './lib/firebase';
import { 
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User 
} from 'firebase/auth';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, query, where, 
  onSnapshot, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { Book, OperationType } from './types';

// Pre-defined static categories for books
const GENRE_PRESETS = [
  "Fiction", "Mystery", "Sci-Fi", "Biography", "Fantasy", 
  "History", "Self-Help", "Kids", "Textbook", "Drama", "Poetry"
];

// Helper to generate elegant seed-based gradients for book covers
function getBookGradient(title: string): string {
  const gradients = [
    "from-indigo-500 to-purple-600",
    "from-rose-500 to-orange-500",
    "from-emerald-400 to-teal-700",
    "from-cyan-500 to-blue-600",
    "from-amber-400 to-pink-500",
    "from-fuchsia-600 to-pink-700",
    "from-violet-600 to-indigo-800",
    "from-yellow-500 to-red-600",
    "from-slate-700 to-slate-900",
    "from-green-500 to-teal-700"
  ];
  let score = 0;
  for (let i = 0; i < title.length; i++) {
    score += title.charCodeAt(i);
  }
  return gradients[score % gradients.length];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [borrowedFilter, setBorrowedFilter] = useState<"all" | "borrowed" | "available">("all");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "year" | "rating">("recent");

  // Form State
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formGenre, setFormGenre] = useState("Fiction");
  const [formRating, setFormRating] = useState(5);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formYear, setFormYear] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formIsBorrowed, setFormIsBorrowed] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Stats calculation
  const totalBooksCount = books.length;
  const borrowedBooksCount = books.filter(b => b.isBorrowed).length;
  const availableBooksCount = totalBooksCount - borrowedBooksCount;
  const avgRating = totalBooksCount > 0 
    ? (books.reduce((acc, b) => acc + (b.rating || 0), 0) / totalBooksCount).toFixed(1) 
    : "0.0";

  // Calculate favorite genre
  const genreCounts: Record<string, number> = {};
  books.forEach(b => {
    if (b.genre) {
      genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1;
    }
  });
  let favoriteGenre = "None";
  let maxCount = 0;
  Object.entries(genreCounts).forEach(([g, count]) => {
    if (count > maxCount) {
      maxCount = count;
      favoriteGenre = g;
    }
  });

  // Track Firebase Auto-State Change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore Books Collection for authenticated user
  useEffect(() => {
    if (!user) {
      setBooks([]);
      return;
    }

    setBooksLoading(true);
    setErrorNotice(null);
    const path = "books";
    const booksQuery = query(collection(db, path), where("userId", "==", user.uid));

    // Listen in real-time
    const unsubscribe = onSnapshot(booksQuery, (snapshot) => {
      const docsList: Book[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docsList.push({
          id: docSnap.id,
          userId: data.userId,
          title: data.title || "",
          author: data.author || "",
          genre: data.genre || "Fiction",
          tags: data.tags || [],
          rating: data.rating || 0,
          image: data.image || "",
          description: data.description || "",
          publicationYear: data.publicationYear || "",
          isBorrowed: data.isBorrowed || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      setBooks(docsList);
      setBooksLoading(false);
    }, (error) => {
      setBooksLoading(false);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (formattedError: any) {
        setErrorNotice(formattedError.message);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Auth Operations
  const handleSignIn = async () => {
    setErrorNotice(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setErrorNotice("Authentication failed. Please verify your internet connection or check browser cookie settings.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      setErrorNotice("Signout failed.");
    }
  };

  // Safe client-side payload validation that mirrors firestore rules limits
  const validatePayload = (title: string, author: string): boolean => {
    if (!title.trim() || title.length > 200) {
      setErrorNotice("Book Title is required and must not exceed 200 characters.");
      return false;
    }
    if (!author.trim() || author.length > 200) {
      setErrorNotice("Author is required and must not exceed 200 characters.");
      return false;
    }
    return true;
  };

  // Enrich with AI using server-side Gemini Proxy API
  const handleEnrichWithAI = async () => {
    if (!formTitle.trim()) {
      setErrorNotice("Please fill in the Book Title before asking AI to enrich details.");
      return;
    }
    setErrorNotice(null);
    setEnriching(true);

    try {
      const response = await fetch("/api/enrich-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formTitle, author: formAuthor })
      });
      const data = await response.json();

      if (data.error) {
        console.warn("AI enrichment warning:", data.error);
      }

      setFormGenre(data.suggestedGenre || "Fiction");
      setFormDescription(data.suggestedDescription || "");
      setFormYear(data.suggestedYear || "");
      if (data.suggestedTags && Array.isArray(data.suggestedTags)) {
        setFormTags(data.suggestedTags.join(", "));
      }
    } catch (err) {
      console.error("Failed to enrich with AI:", err);
      setErrorNotice("Could not reach AI Assistant. Falling back to manual entry.");
    } finally {
      setEnriching(false);
    }
  };

  // Submit create or update
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorNotice(null);

    if (!validatePayload(formTitle, formAuthor)) {
      return;
    }

    const tagsArray = formTags
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
      .slice(0, 10); // Firestore rule says array size limit

    const bookPath = "books";

    try {
      if (formMode === "create") {
        const bookDocRef = doc(collection(db, bookPath));
        const newBookPayload = {
          id: bookDocRef.id,
          userId: user.uid,
          title: formTitle.trim(),
          author: formAuthor.trim(),
          genre: formGenre,
          rating: formRating,
          image: formImageUrl.trim(),
          description: formDescription.trim(),
          publicationYear: formYear.trim(),
          tags: tagsArray,
          isBorrowed: formIsBorrowed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(bookDocRef, newBookPayload);
      } else {
        if (!editingBookId) return;
        const bookDocRef = doc(db, bookPath, editingBookId);
        
        const updateBookPayload = {
          title: formTitle.trim(),
          author: formAuthor.trim(),
          genre: formGenre,
          rating: formRating,
          image: formImageUrl.trim(),
          description: formDescription.trim(),
          publicationYear: formYear.trim(),
          tags: tagsArray,
          isBorrowed: formIsBorrowed,
          updatedAt: serverTimestamp() // rule enforces updatedAt is request.time
        };

        await updateDoc(bookDocRef, updateBookPayload);
      }

      // Reset form on success
      resetForm();
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.WRITE, bookPath);
      } catch (formattedError: any) {
        setErrorNotice(JSON.parse(formattedError.message).error);
      }
    }
  };

  const handleEditClick = (book: Book) => {
    setFormMode("edit");
    setEditingBookId(book.id);
    setFormTitle(book.title);
    setFormAuthor(book.author);
    setFormGenre(book.genre || "Fiction");
    setFormRating(book.rating || 5);
    setFormImageUrl(book.image || "");
    setFormDescription(book.description || "");
    setFormYear(book.publicationYear || "");
    setFormTags(book.tags ? book.tags.join(", ") : "");
    setFormIsBorrowed(book.isBorrowed || false);
    setErrorNotice(null);

    // Scroll smoothly to form
    const element = document.getElementById("form-card");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDeleteClick = async (bookId: string) => {
    if (!window.confirm("Are you certain you want to remove this catalogued book?")) {
      return;
    }
    setErrorNotice(null);
    const bookPath = "books";

    try {
      await deleteDoc(doc(db, bookPath, bookId));
      if (editingBookId === bookId) {
        resetForm();
      }
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.DELETE, bookPath);
      } catch (formattedError: any) {
        setErrorNotice(JSON.parse(formattedError.message).error);
      }
    }
  };

  const resetForm = () => {
    setFormMode("create");
    setEditingBookId(null);
    setFormTitle("");
    setFormAuthor("");
    setFormGenre("Fiction");
    setFormRating(5);
    setFormImageUrl("");
    setFormDescription("");
    setFormYear("");
    setFormTags("");
    setFormIsBorrowed(false);
  };

  // Filter & Search Logic
  const filteredBooks = books.filter(b => {
    const matchesSearch = 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.tags && b.tags.some(t => t.includes(searchQuery.toLowerCase())));
    
    const matchesGenre = selectedGenre === "All" || b.genre === selectedGenre;
    
    const matchesBorrowed = 
      borrowedFilter === "all" ||
      (borrowedFilter === "borrowed" && b.isBorrowed) ||
      (borrowedFilter === "available" && !b.isBorrowed);

    return matchesSearch && matchesGenre && matchesBorrowed;
  }).sort((a, b) => {
    if (sortBy === "title") {
      return a.title.localeCompare(b.title);
    } else if (sortBy === "year") {
      return (b.publicationYear || "").localeCompare(a.publicationYear || "");
    } else if (sortBy === "rating") {
      return (b.rating || 0) - (a.rating || 0);
    } else {
      // Sort by recent addition: use dynamic JS timestamp conversion or id fallback
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    }
  });

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 transition-colors duration-200">
      
      {/* Banner / Header Branding */}
      <header id="header-bar" className="border-b border-slate-100 bg-white/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-sm flex items-center justify-center">
              <Library className="w-5 h-5" id="header-logo-icon" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-slate-900 tracking-tight leading-none">
                Bibliotech
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5" id="header-subtitle">
                Library Catalogue System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AnimatePresence mode="wait">
              {authLoading ? (
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking state...
                </div>
              ) : user ? (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3"
                  id="user-profile-widget"
                >
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-semibold text-slate-900" id="user-display-name">
                      {user.displayName || "Librarian"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400" id="user-display-email">
                      {user.email}
                    </span>
                  </div>
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                      id="user-avatar-img"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-inner">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-medium transition-colors border border-slate-200/50"
                    id="sign-out-btn"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={handleSignIn}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                  id="sign-in-btn"
                >
                  <LogIn className="w-4 h-4" /> Sign In with Google
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Error Notice Hub */}
        <AnimatePresence>
          {errorNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 flex items-start gap-3 shadow-sm"
              id="error-notice-card"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-bold font-display uppercase tracking-wider text-amber-800">
                  Transaction Security Warning
                </h4>
                <p className="text-xs text-amber-700 font-mono mt-1 leading-relaxed">
                  {errorNotice}
                </p>
              </div>
              <button 
                onClick={() => setErrorNotice(null)}
                className="text-amber-500 hover:text-amber-800 p-1"
                id="close-error-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!user ? (
          /* Authentication Screen Call to Action */
          <div className="flex flex-col items-center justify-center py-20 text-center" id="unauth-landing">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <Library className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h2 className="font-display font-bold text-3xl text-slate-900 tracking-tight max-w-md">
              Secure Personal Library Catalogue
            </h2>
            <p className="text-slate-500 text-sm max-w-md mt-3 mb-8 leading-relaxed">
              Connect your authentic workspace project collection securely via Firebase and curate your favorite books, authors, loan status, and logs.
            </p>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleSignIn}
                className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-semibold shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all w-64 justify-center"
                id="landing-sign-in-btn"
              >
                <LogIn className="w-5 h-5" /> Sign In with Google
              </button>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> Uses Sandbox Secure Authentication
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard Core */
          <div className="space-y-8">
            
            {/* Quick Counters & Metrics Block */}
            <section id="metrics-panel" className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4" id="metric-total">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 flex items-center justify-center">
                  <Library className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Total Books</div>
                  <div className="text-2xl font-bold font-display text-slate-900 mt-0.5">{booksLoading ? "..." : totalBooksCount}</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4" id="metric-borrowed">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 flex items-center justify-center">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Borrowed</div>
                  <div className="text-2xl font-bold font-display text-slate-900 mt-0.5">{booksLoading ? "..." : borrowedBooksCount}</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4" id="metric-genre">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 flex items-center justify-center">
                  <Heart className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Top Genre</div>
                  <div className="text-md font-bold font-display text-slate-900 truncate max-w-[130px] mt-2">
                    {booksLoading ? "..." : favoriteGenre}
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4" id="metric-rating">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-rose-500" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase font-semibold">Average Rating</div>
                  <div className="text-2xl font-bold font-display text-slate-900 mt-0.5">{booksLoading ? "..." : avgRating} <span className="text-xs text-slate-400">/ 5</span></div>
                </div>
              </div>

            </section>

            {/* Split Screen Grid Workbenches */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Form Editor Card */}
              <div className="lg:col-span-5 space-y-6">
                <div 
                  id="form-card" 
                  className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-display font-semibold text-lg text-slate-900">
                        {formMode === "create" ? "Catalog New Book" : "Edit Book Details"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {formMode === "create" ? "Integrate works directly into Firestore" : "Update item in real-time database"}
                      </p>
                    </div>
                    {formMode === "edit" && (
                      <button 
                        onClick={resetForm}
                        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-100 transition-colors"
                        id="form-cancel-edit"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel (Add mode)
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    
                    <div>
                      <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                        Book Title *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g. Sapiens"
                          className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                          id="input-book-title"
                        />
                        <button
                          type="button"
                          onClick={handleEnrichWithAI}
                          disabled={enriching || !formTitle.trim()}
                          className="absolute right-2 top-2 p-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-300 text-indigo-600 rounded-lg text-[10px] font-bold font-display tracking-wide flex items-center gap-1 transition-all"
                          id="btn-enrich-ai"
                          title="Auto-fill Metadata with Gemini"
                        >
                          {enriching ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          AI Assistant
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                          Author *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={formAuthor}
                          onChange={(e) => setFormAuthor(e.target.value)}
                          placeholder="e.g. Yuval Noah Harari"
                          className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                          id="input-book-author"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                          Genre
                        </label>
                        <select
                          value={formGenre}
                          onChange={(e) => setFormGenre(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                          id="input-book-genre"
                        >
                          {GENRE_PRESETS.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                          Publication Year
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={formYear}
                          onChange={(e) => setFormYear(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 2011"
                          className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                          id="input-book-year"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                          Cabinet Rating
                        </label>
                        <div className="flex items-center gap-1.5 h-10 px-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormRating(star)}
                              className="text-slate-200 hover:scale-110 transition-transform p-1"
                              id={`star-btn-${star}`}
                            >
                              <Star 
                                className={`w-5 h-5 ${star <= formRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} 
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                        Cover Image Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={formImageUrl}
                        onChange={(e) => setFormImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-mono text-[10px]"
                        id="input-book-image"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                        Description / Summary
                      </label>
                      <textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Brief summary of the novel content or educational guide notes."
                        rows={3}
                        className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                        id="input-book-desc"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase mb-1.5">
                        Book Tags (comma separated)
                      </label>
                      <input
                        type="text"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="e.g. non-fiction, philosophy, history"
                        className="w-full px-4 py-3 border border-slate-200/80 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                        id="input-book-tags"
                      />
                    </div>

                    {/* Borrowed Status Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/40 rounded-2xl">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Currently Borrowed</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Toggle if this book is actively checked out</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormIsBorrowed(!formIsBorrowed)}
                        className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${formIsBorrowed ? "bg-amber-500" : "bg-slate-200"}`}
                        id="borrowed-field-toggle"
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform duration-200 ${formIsBorrowed ? "translate-x-6" : "translate-x-0"}`} />
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                      id="form-submit-btn"
                    >
                      {formMode === "create" ? (
                        <>
                          <Plus className="w-4 h-4" /> Catalogue Document
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Save Modification
                        </>
                      )}
                    </button>

                  </form>
                </div>
              </div>

              {/* Right Column: Collection Catalog Listing */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Filtration and Search Controls */}
                <div id="controls-card" className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    
                    {/* Text Search input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search books, authors, description, tags..."
                        className="w-full pl-10 pr-4 py-3 border border-slate-200/80 rounded-2xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                        id="catalog-search"
                      />
                    </div>

                    {/* Genre select standard */}
                    <div className="w-full sm:w-48">
                      <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200/80 rounded-2xl text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-medium"
                        id="catalog-genre-filter"
                      >
                        <option value="All">All Genres</option>
                        {GENRE_PRESETS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    
                    {/* Borrowed/Available Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      {(["all", "borrowed", "available"] as const).map((filterOpt) => (
                        <button
                          key={filterOpt}
                          onClick={() => setBorrowedFilter(filterOpt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide capitalize transition-all ${borrowedFilter === filterOpt ? "bg-white text-slate-900 shadow-sm border border-slate-200/30" : "text-slate-400 hover:text-slate-600"}`}
                          id={`filter-borrow-${filterOpt}`}
                        >
                          {filterOpt}
                        </button>
                      ))}
                    </div>

                    {/* Sorting selector */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-mono text-[10px] tracking-wide uppercase">Sort by:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none text-slate-700"
                        id="catalog-sorter"
                      >
                        <option value="recent">Recently Added</option>
                        <option value="title">Book Title</option>
                        <option value="year">Publication Year</option>
                        <option value="rating">Rating</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* Database Collection Results list */}
                <div id="books-feed">
                  
                  {booksLoading ? (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                      Streaming files securely from Firestore...
                    </div>
                  ) : filteredBooks.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-500" id="empty-feed-card">
                      <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                      <h4 className="font-display font-semibold text-slate-800 text-sm">No Books Found</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                        No books match the filters or search keywords query. Get started by cataloguing a new book.
                      </p>
                    </div>
                  ) : (
                    <motion.div 
                      layout
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      id="books-grid"
                    >
                      <AnimatePresence mode="popLayout">
                        {filteredBooks.map((book) => {
                          const hasImg = book.image && book.image.trim().startsWith("http");
                          const gradClass = getBookGradient(book.title);
                          
                          return (
                            <motion.div
                              layout
                              key={book.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-indigo-600/5 hover:shadow-lg transition-all rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden"
                              id={`book-card-${book.id}`}
                            >
                              {/* Pulse borrowed banner if checked out */}
                              {book.isBorrowed && (
                                <div className="absolute top-2.5 right-2.5 z-10 bg-amber-500/90 text-[9px] font-bold tracking-wider font-display uppercase px-2 py-0.5 rounded-full text-white flex items-center gap-1 shadow-sm shadow-amber-500/10">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  Borrowed
                                </div>
                              )}

                              <div className="flex gap-4 items-start">
                                
                                {/* Aesthetic Seed-Based Hard Cover Cover */}
                                <div className="w-20 h-28 shrink-0 rounded-2xl overflow-hidden shadow-sm relative group bg-slate-150 border border-slate-100">
                                  {hasImg ? (
                                    <img 
                                      src={book.image} 
                                      alt={book.title} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        // Reset link if broken to fall back to gradient spine
                                        (e.target as any).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${gradClass} p-2.5 flex flex-col justify-between text-white relative`}>
                                      {/* Tiny decorative gold line */}
                                      <div className="w-1 h-full bg-yellow-400/20 absolute left-1.5 top-0" />
                                      
                                      <span className="text-[7px] font-bold tracking-widest font-mono uppercase opacity-50 truncate">
                                        {book.genre || "Fiction"}
                                      </span>
                                      
                                      <span className="text-xs font-display font-semibold select-none leading-tight tracking-tight mt-auto block font-bold text-white drop-shadow-sm truncate-2-lines">
                                        {book.title}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] font-bold uppercase font-mono tracking-widest text-indigo-500 bg-indigo-50/60 px-2 py-0.5 rounded-md">
                                    {book.genre || "Fiction"}
                                  </span>

                                  <h4 className="font-display font-bold text-sm text-slate-900 leading-snug mt-1.5 truncate">
                                    {book.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 truncate">
                                    by {book.author}
                                  </p>

                                  {/* Cabin Rating Stars */}
                                  <div className="flex items-center gap-0.5 mt-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`w-3 h-3 ${i < (book.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} 
                                      />
                                    ))}
                                    {book.publicationYear && (
                                      <span className="text-[10px] font-mono text-slate-400 ml-2">
                                        • {book.publicationYear}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Long summary description if typed */}
                              {book.description ? (
                                <p className="text-xs text-slate-500 bg-slate-50/50 p-2.5 rounded-2xl mt-4 line-clamp-2 leading-relaxed italic">
                                  "{book.description}"
                                </p>
                              ) : (
                                <div className="h-0.5 mt-2" />
                              )}

                              {/* Tags lists */}
                              {book.tags && book.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {book.tags.map((tag) => (
                                    <span 
                                      key={tag} 
                                      className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 flex items-center gap-0.5"
                                    >
                                      <Tag className="w-2.5 h-2.5 text-slate-350" /> {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Action Workbench Controls */}
                              <div className="flex items-center justify-end gap-2 pt-3 mt-4 border-t border-slate-100">
                                <button
                                  onClick={() => handleEditClick(book)}
                                  className="p-1 px-2.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-[10px] font-bold tracking-wide transition-colors flex items-center gap-1"
                                  id={`edit-btn-${book.id}`}
                                >
                                  <Edit3 className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(book.id)}
                                  className="p-1 px-2.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-100 rounded-xl text-[10px] font-bold tracking-wide transition-colors flex items-center gap-1"
                                  id={`delete-btn-${book.id}`}
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>

                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Footer Copyright */}
      <footer className="border-t border-slate-100 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-[11px] font-mono text-slate-400">
          <p id="footer-credits">
            Authentic cloud-bound catalogue secured by attribute-level ACL rules.
          </p>
          <p className="mt-1" id="footer-copyright">
            © {new Date().getFullYear()} Bibliotech Inc. All rights protected.
          </p>
        </div>
      </footer>

    </div>
  );
}
