/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Book, SortOption } from './types';
import { Plus, Trash2, BookOpen, ArrowUp, Moon, Sun, Star, StarHalf, Download, Upload } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [books, setBooks] = useState<Book[]>(() => {
    const savedBooks = localStorage.getItem('books');
    if (!savedBooks) return [];
    try {
      const parsed = JSON.parse(savedBooks);
      return parsed.map((book: any) => ({
        ...book,
        tags: book.tags || [],
        rating: book.rating || 0,
      }));
    } catch {
      return [];
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [rating, setRating] = useState('');
  const [isbn, setIsbn] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('title-asc');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  useEffect(() => {
    localStorage.setItem('books', JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const uniqueGenresList = Array.from(new Set(books.map(b => b.genre)));
  const uniqueTagsList = Array.from(new Set(books.flatMap(b => b.tags)));

  const addBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author || !genre) {
      setError('Please fill in all required fields (Title, Author, Genre).');
      return;
    }
    setError(null);

    const newBook: Book = {
      id: crypto.randomUUID(),
      title,
      author,
      genre,
      publicationYear: parseInt(publicationYear) || 0,
      description,
      image,
      isBorrowed: false,
      isRead: false,
      rating: parseFloat(rating) || 0,
      tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
    };

    setBooks([...books, newBook]);
    setTitle('');
    setAuthor('');
    setGenre('');
    setPublicationYear('');
    setDescription('');
    setImage('');
    setRating('');
    setIsbn('');
    setTagsInput('');
  };

  const [isFetching, setIsFetching] = useState(false);

  const fetchBookData = async () => {
    if (!isbn) {
      setError("Please enter a title or ISBN.");
      return;
    }
    
    setIsFetching(true);
    setError(null);
    
    try {
      // Determine if input is ISBN
      const isIsbn = /^\d+$/.test(isbn);
      const url = isIsbn 
        ? `https://openlibrary.org/search.json?isbn=${isbn}`
        : `https://openlibrary.org/search.json?q=${encodeURIComponent(isbn)}`;
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.docs && data.docs.length > 0) {
        const book = data.docs[0];
        setTitle(book.title || '');
        setAuthor(book.author_name ? book.author_name.join(', ') : 'Unknown Author');
        setGenre(book.subject ? book.subject[0] : 'General');
        setPublicationYear(book.first_publish_year ? book.first_publish_year.toString() : '');
        
        if (book.isbn && book.isbn[0]) {
          setImage(`https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-L.jpg`);
        } else {
            setImage('');
        }
        
        setTagsInput(book.subject ? book.subject.slice(0, 5).join(', ') : '');
        setDescription(book.first_sentence || 'No description available.');
        setRating('0.0');
      } else {
        setError("Book not found. Please try a different title or ISBN.");
      }
    } catch (err) {
      console.error('Failed to fetch book data', err);
      setError("Failed to fetch book data. Please try again later.");
    } finally {
      setIsFetching(false);
    }
  };

  const toggleBorrowStatus = (id: string) => {
    setBooks(books.map(book => 
      book.id === id ? { ...book, isBorrowed: !book.isBorrowed } : book
    ));
  };

  const toggleReadStatus = (id: string) => {
    setBooks(books.map(book => 
      book.id === id ? { ...book, isRead: !book.isRead } : book
    ));
  };

  const deleteBook = (id: string) => {
    setBooks(books.filter(book => book.id !== id));
  };

  const exportLibrary = () => {
    const data = JSON.stringify(books);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        setBooks(data);
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const sortedFilteredBooks = books
    .filter(book => 
      (book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
       book.author.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (selectedGenre === null || book.genre === selectedGenre) &&
      (selectedTag === null || book.tags.includes(selectedTag))
    )
    .sort((a, b) => {
      switch (sortOption) {
        case 'title-asc': return a.title.localeCompare(b.title);
        case 'title-desc': return b.title.localeCompare(a.title);
        case 'author-asc': return a.author.localeCompare(b.author);
        case 'author-desc': return b.author.localeCompare(a.author);
        default: return 0;
      }
    });


  const totalBooks = books.length;
  const borrowedBooks = books.filter(b => b.isBorrowed).length;
  const uniqueGenres = new Set(books.map(b => b.genre)).size;
  const genreCounts = books.reduce((acc, book) => { 
    acc[book.genre] = (acc[book.genre] || 0) + 1; 
    return acc; 
  }, {} as Record<string, number>);
  const tagCounts = books.flatMap(b => b.tags).reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedBookId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4 sm:p-8`}>
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center relative">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="absolute -top-2 right-0 p-3 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 z-50"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <h1 className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 mb-2">Library Catalogue</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage and track your private collection with ease.</p>
        </header>

        <form onSubmit={addBook} className="bg-white dark:bg-gray-900 p-6 sm:p-10 rounded-[2rem] shadow-xl shadow-purple-500/10 dark:shadow-purple-500/5 border border-gray-100 dark:border-gray-800 mb-12 grid grid-cols-1 md:grid-cols-2 gap-6 transition-shadow duration-300">
          {error && <p className="md:col-span-2 text-red-500 text-sm font-medium">{error}</p>}
          
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="ISBN or Title for Auto-Fill"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
            />
            <button type="button" onClick={fetchBookData} disabled={isFetching} className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-semibold hover:bg-purple-700 transition-all disabled:opacity-50">
              {isFetching ? 'Fetching...' : 'Fetch Data'}
            </button>
          </div>
          
          <input
            type="text"
            placeholder="Book Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <input
            type="number"
            placeholder="Year"
            value={publicationYear}
            onChange={(e) => setPublicationYear(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          
          <input
            type="text"
            placeholder="Image URL"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <input
            type="number"
            placeholder="Rating (1-5)"
            min="1"
            max="5"
            step="0.1"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="md:col-span-2 px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="md:col-span-2 px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-400 outline-none transition-all"
          />
          <button type="submit" className="md:col-span-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-8 py-5 rounded-3xl font-semibold text-lg flex items-center justify-center gap-2 hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]">
            <Plus size={22} /> Add Book to Collection
          </button>
        </form>

        <div className="mb-10 p-6 sm:p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap justify-between text-sm text-gray-500 dark:text-gray-400 mb-4 gap-2">
            <span>Library Status: Borrowed vs Available</span>
            <div className="flex gap-4">
              <button onClick={exportLibrary} className="flex items-center gap-1.5 hover:text-purple-600 transition-colors"><Download size={16}/> Export</button>
              <label className="flex items-center gap-1.5 hover:text-purple-600 cursor-pointer transition-colors">
                <Upload size={16}/> Import
                <input type="file" className="hidden" accept=".json" onChange={importLibrary} />
              </label>
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden flex shadow-inner">
            <div style={{ width: `${totalBooks > 0 ? (borrowedBooks / totalBooks) * 100 : 0}%` }} className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-500" />
            <div style={{ width: `${totalBooks > 0 ? 100 - (borrowedBooks / totalBooks) * 100 : 100}%` }} className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-500" />
          </div>
          <p className="text-right text-xs text-gray-400 mt-2">{borrowedBooks} / {totalBooks} books borrowed</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Books</p>
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{totalBooks}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Borrowed</p>
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{borrowedBooks}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Genres</p>
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{uniqueGenres}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search your collection..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all text-gray-900 dark:text-gray-100"
            />
            <select 
              value={sortOption} 
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full sm:w-auto px-6 py-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-sm focus:ring-2 focus:ring-purple-400 outline-none text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
            >
              <option value="title-asc">Sort: A-Z</option>
              <option value="title-desc">Sort: Z-A</option>
              <option value="author-asc">Sort: Author A-Z</option>
              <option value="author-desc">Sort: Author Z-A</option>
            </select>
          </div>
          
          <div className="space-y-4">
            <button
               onClick={() => { setSelectedGenre(null); setSelectedTag(null); }}
               className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedGenre === null && selectedTag === null ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-gray-700'}`}
            >
               All Books
            </button>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Genres</h4>
              <div className="flex flex-wrap gap-2">
                {uniqueGenresList.map(genre => (
                  <button
                    key={genre}
                    onClick={() => { setSelectedGenre(genre); setSelectedTag(null); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedGenre === genre ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-50'}`}
                  >
                    {genre} <span className="opacity-60 font-normal">({genreCounts[genre]})</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {uniqueTagsList.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setSelectedTag(tag); setSelectedGenre(null); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedTag === tag ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50'}`}
                  >
                    {tag} <span className="opacity-60 font-normal">({tagCounts[tag]})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-100 dark:shadow-gray-950 border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {sortedFilteredBooks.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
              <BookOpen size={48} className="mb-4 text-purple-300 dark:text-purple-700" />
              <p className="text-lg font-medium">{books.length === 0 ? 'Your library is empty. Add a book to get started!' : 'No books match your search.'}</p>
            </div>
          ) : (
            <AnimatePresence>
              {sortedFilteredBooks.map(book => (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.02 }}
                  key={book.id} 
                  className="p-4 flex flex-col hover:bg-gradient-to-r hover:from-white hover:to-purple-50 dark:hover:bg-gradient-to-r dark:hover:from-gray-900 dark:hover:to-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between cursor-pointer w-full" onClick={() => setExpandedBookId(expandedBookId === book.id ? null : book.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`overflow-hidden w-12 h-12 rounded-2xl flex items-center justify-center text-white bg-gray-100 dark:bg-gray-800`}>
                        {book.image ? (
                          <img 
                            src={book.image} 
                            alt={book.title} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { 
                              e.currentTarget.style.display = 'none'; 
                              e.currentTarget.nextElementSibling?.classList.remove('hidden'); 
                            }} 
                          />
                        ) : null}
                          <div className={`${book.image ? 'hidden' : ''} bg-gradient-to-br from-purple-500 to-pink-500 w-full h-full flex items-center justify-center`}>
                            <BookOpen size={20} />
                          </div>

                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{book.title}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500 dark:text-gray-400">{book.author}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">{book.genre}</span>
                          {book.tags && book.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => toggleBorrowStatus(book.id)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${book.isBorrowed ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'}`}
                      >
                        {book.isBorrowed ? 'Return' : 'Borrow'}
                      </button>
                      <button onClick={() => setBookToDelete(book)} className="text-gray-400 hover:text-red-600 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  {expandedBookId === book.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 pt-4 border-t border-purple-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <p><strong>Published:</strong> {book.publicationYear}</p>
                        <div className="flex items-center gap-1 text-amber-400">
                          {[...Array(5)].map((_, i) => {
                            if (i < Math.floor(book.rating)) return <Star key={i} size={16} fill="currentColor" />;
                            if (i === Math.floor(book.rating) && book.rating % 1 >= 0.5) return <StarHalf key={i} size={16} fill="currentColor" />;
                            return <Star key={i} size={16} fill="none" className="text-gray-300 dark:text-gray-600" />;
                          })}
                          <span className="text-sm text-gray-600 dark:text-gray-300 ml-2 font-medium">{book.rating.toFixed(1)}</span>
                        </div>
                        <button
                          onClick={() => toggleReadStatus(book.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${book.isRead ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
                        >
                          {book.isRead ? 'Mark as Unread' : 'Mark as Read'}
                        </button>
                      </div>
                      <p className="mt-2 text-gray-700 dark:text-white max-h-48 overflow-y-auto">{book.description}</p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        {bookToDelete && (
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-sm w-full border border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">Delete Book</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete <span className="font-medium">"{bookToDelete.title}"</span>? This cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setBookToDelete(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">Cancel</button>
                <button 
                  onClick={() => {
                    setBooks(books.filter(b => b.id !== bookToDelete.id));
                    setBookToDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-8 right-8 bg-gradient-to-r from-purple-600 to-pink-500 text-white p-3 rounded-full shadow-lg hover:from-purple-700 hover:to-pink-600 transition-all z-50"
            >
              <ArrowUp size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

