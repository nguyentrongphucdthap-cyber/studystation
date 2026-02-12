// ============================================================
// USER & AUTH TYPES
// ============================================================

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
}

export type UserRole = 'user' | 'admin' | 'super-admin' | 'admin/user' | 'super-admin/admin/user' | 'guest';

export interface AllowedUser {
    email: string;
    role: string;
    name?: string;
    addedBy?: string;
    addedAt?: string;
}

export type DeviceType = 'desktop' | 'mobile';

export interface AuthState {
    user: UserProfile | null;
    role: UserRole;
    isAuthenticated: boolean;
    isLoading: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isGuest: boolean;
}

// ============================================================
// EXAM TYPES (Practice)
// ============================================================

export interface Part1Question {
    id: number;
    text: string;
    image?: string;
    options: [string, string, string, string];
    correct: 0 | 1 | 2 | 3;
}

export interface Part2SubQuestion {
    id: 'a' | 'b' | 'c' | 'd';
    text: string;
    correct: boolean;
}

export interface Part2Question {
    id: number;
    text: string;
    image?: string;
    subQuestions: Part2SubQuestion[];
}

export interface Part3Question {
    id: number;
    text: string;
    image?: string;
    correct: string;
}

export interface Exam {
    id: string;
    title: string;
    subjectId: string;
    time: number; // minutes
    part1?: Part1Question[];
    part2?: Part2Question[];
    part3?: Part3Question[];
    attemptCount?: number;
    createdAt?: string;
    createdBy?: string;
    examCode?: string;
}

export interface ExamMetadata {
    id: string;
    title: string;
    subjectId: string;
    time: number;
    attemptCount?: number;
    createdAt?: string;
    examCode?: string;
    questionCount?: {
        part1: number;
        part2: number;
        part3: number;
    };
}

// ============================================================
// E-TEST TYPES
// ============================================================

export interface EtestSection {
    passage: string;
    questions: EtestQuestion[];
}

export interface EtestQuestion {
    id: number;
    text: string;
    options: string[];
    correct: number;
}

export interface EtestExam {
    id: string;
    title: string;
    tag?: string;
    time: number;
    sections: EtestSection[];
    createdAt?: string;
    createdBy?: string;
}

// ============================================================
// VOCAB TYPES
// ============================================================

export interface VocabWord {
    word: string;
    meaning: string;
    example?: string;
    pronunciation?: string;
    partOfSpeech?: string;
}

export interface VocabSet {
    id: string;
    title: string;
    category: 'gdpt' | 'advanced_gdpt' | 'topic';
    words: VocabWord[];
    createdAt?: string;
    createdBy?: string;
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

export type NotificationCategory = 'update' | 'remove' | 'edit' | 'fix' | 'new' | 'info';

export interface Notification {
    id: string;
    title: string;
    content: string;
    author: string;
    category: NotificationCategory;
    isNew?: boolean;
    createdAt?: string;
}

// ============================================================
// PRACTICE LOG / HISTORY TYPES
// ============================================================

export interface PracticeLog {
    id: string;
    examId: string;
    examTitle: string;
    subjectId: string;
    userEmail: string;
    userName?: string;
    mode: 'classic' | 'review';
    score?: number;
    correctCount?: number;
    totalQuestions?: number;
    durationSeconds?: number;
    timestamp: string;
}

export interface PracticeHistory {
    id: string;
    userId: string;
    examId: string;
    examTitle: string;
    subjectId: string;
    score: number;
    correctCount: number;
    totalQuestions: number;
    durationSeconds: number;
    answers: Record<string, unknown>;
    timestamp: string;
}

export interface HighestScores {
    [examId: string]: {
        highestScore: number;
        attemptCount: number;
    };
}

// ============================================================
// FEEDBACK TYPES
// ============================================================

export interface FeedbackComment {
    id: string;
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    isFixed?: boolean;
    replies?: FeedbackReply[];
    createdAt: string;
}

export interface FeedbackReply {
    id: string;
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    createdAt: string;
}

// ============================================================
// SUBJECT TYPES
// ============================================================

export interface Subject {
    id: string;
    name: string;
    icon: string;
    color: string;
}

// ============================================================
// ACTIVITY LOG TYPES
// ============================================================

export interface ActivityLog {
    id: string;
    userEmail: string;
    userName?: string;
    moduleName: string;
    moduleLabel: string;
    timestamp: string;
    deviceType?: string;
}
