export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  isBorrowed: boolean;
  isRead: boolean;
  publicationYear: number;
  description: string;
  image: string | null;
  rating: number;
  tags: string[];
}

export type SortOption = 'title-asc' | 'title-desc' | 'author-asc' | 'author-desc';
