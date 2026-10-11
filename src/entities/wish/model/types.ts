import type { Profile } from '@/entities/user';

export type Vote = -1 | 0 | 1;

export interface Wish {
  id: string;
  text: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  my: Vote;
  mine: boolean;
  reported: boolean;
}

export interface Winner {
  weekId: string;
  text: string;
  likes: number;
  dislikes: number;
}

export interface Board {
  me: Profile | null;
  weekId: string;
  deadline: string;
  posts: Wish[];
  previous: Pick<Wish, 'id' | 'text' | 'likes' | 'dislikes'>[];
  lastWinner: Winner | null;
  history: Winner[];
  postsLeft: number;
  maxPerWeek: number;
}
