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
  aiScore: number | null; // оценка ИИ 1–10
  aiComment: string | null;
}

export interface AiPick {
  id: string;
  text: string;
  aiScore: number;
  aiComment: string | null;
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
  aiTop: AiPick[]; // лучшие предложения недели по мнению ИИ
  previous: Pick<Wish, 'id' | 'text' | 'likes' | 'dislikes'>[];
  lastWinner: Winner | null;
  history: Winner[];
  postsLeft: number;
  maxPerWeek: number;
}
