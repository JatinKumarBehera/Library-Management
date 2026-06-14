export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string;
  isBorrowed: boolean;
}

export type SortOption = 'title-asc' | 'title-desc' | 'author-asc' | 'author-desc';
