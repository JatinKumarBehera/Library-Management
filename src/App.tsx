/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Book, SortOption } from './types';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('title-asc');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  const addBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author || !genre) return;

    const newBook: Book = {
      id: crypto.randomUUID(),
      title,
      author,
      genre,
      isBorrowed: false,
    };

    setBooks([...books, newBook]);
    setTitle('');
    setAuthor('');
    setGenre('');
  };

  const toggleBorrowStatus = (id: string) => {
    setBooks(books.map(book => 
      book.id === id ? { ...book, isBorrowed: !book.isBorrowed } : book
    ));
  };

  const deleteBook = (id: string) => {
    setBooks(books.filter(book => book.id !== id));
  };

  const sortedFilteredBooks = books
    .filter(book => 
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 mb-2">Library Catalogue</h1>
          <p className="text-gray-500">Manage and track your private collection with ease.</p>
        </header>

        <form onSubmit={addBook} className="bg-white p-6 rounded-2xl shadow-xl shadow-purple-100 border border-purple-50 mb-8 flex gap-3 transition-shadow duration-300">
          <input
            type="text"
            placeholder="Book Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 px-5 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-300 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="flex-1 px-5 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-300 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="flex-1 px-5 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-300 outline-none transition-all"
          />
          <button type="submit" className="bg-gradient-to-br from-purple-600 to-pink-500 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 hover:from-purple-700 hover:to-pink-600 transition-all flex-shrink-0 shadow-lg shadow-purple-500/30">
            <Plus size={18} /> Add
          </button>
        </form>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 hover:bg-gradient-to-br from-white to-purple-50 transition-colors text-center">
            <p className="text-sm text-gray-500 mb-1">Total Books</p>
            <p className="text-3xl font-bold text-gray-900">{totalBooks}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 hover:bg-gradient-to-br from-white to-amber-50 transition-colors text-center">
            <p className="text-sm text-gray-500 mb-1">Borrowed</p>
            <p className="text-3xl font-bold text-gray-900">{borrowedBooks}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 hover:bg-gradient-to-br from-white to-blue-50 transition-colors text-center">
            <p className="text-sm text-gray-500 mb-1">Genres</p>
            <p className="text-3xl font-bold text-gray-900">{uniqueGenres}</p>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          <input
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-5 py-3 border border-gray-200 rounded-full bg-white shadow-sm focus:ring-2 focus:ring-purple-300 outline-none transition-all"
          />
          <select 
            value={sortOption} 
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-5 py-3 border border-gray-200 rounded-full bg-gradient-to-r from-white to-gray-50 shadow-sm focus:ring-2 focus:ring-purple-300 outline-none text-gray-700 transition-all cursor-pointer"
          >
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
            <option value="author-asc">Author (A-Z)</option>
            <option value="author-desc">Author (Z-A)</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100 border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {sortedFilteredBooks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {books.length === 0 ? 'No books found. Add some to get started!' : 'No books match your search.'}
            </div>
          ) : (
            <AnimatePresence>
              {sortedFilteredBooks.map(book => (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={book.id} 
                  className="p-4 flex items-center justify-between hover:bg-gradient-to-r hover:from-white hover:to-purple-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${book.isBorrowed ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{book.title}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">{book.author}</p>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{book.genre}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleBorrowStatus(book.id)}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${book.isBorrowed ? 'bg-gray-100' : 'bg-gray-900 text-white'}`}
                    >
                      {book.isBorrowed ? 'Return' : 'Borrow'}
                    </button>
                    <button onClick={() => setBookToDelete(book)} className="text-gray-400 hover:text-red-600 p-2">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        {bookToDelete && (
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <h3 className="font-semibold text-lg mb-2">Delete Book</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to delete <span className="font-medium">"{bookToDelete.title}"</span>? This cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setBookToDelete(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
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
      </div>
    </div>
  );
}

