import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSubjects, getAllExams } from '../exam.service';
import { getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    getDocs: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
}));

vi.mock('../../config/firebase', () => ({
    db: {},
    auth: {
        currentUser: { email: 'test@example.com' }
    }
}));

describe('exam.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSubjects', () => {
        it('should return a list of subjects', () => {
            const subjects = getSubjects();
            expect(subjects).toBeInstanceOf(Array);
            expect(subjects.length).toBeGreaterThan(0);
            expect(subjects[0]).toHaveProperty('id');
            expect(subjects[0]).toHaveProperty('name');
        });
    });

    describe('getAllExams', () => {
        it('should fetch and return exams from Firestore', async () => {
            const mockDocs = [
                { id: '1', data: () => ({ title: 'Exam 1', subjectId: 'toan' }) },
                { id: '2', data: () => ({ title: 'Exam 2', subjectId: 'ly' }) },
            ];

            (getDocs as any).mockResolvedValueOnce({
                docs: mockDocs
            });

            const exams = await getAllExams();
            expect(exams).toHaveLength(2);
            expect(exams[0]!.id).toBe('1');
            expect(exams[0]!.title).toBe('Exam 1');
            expect(getDocs).toHaveBeenCalled();
        });
    });
});
