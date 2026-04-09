import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createExam, getExamContent, updateExam, getSubjects } from '@/services/exam.service';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { LaTeXEditor } from '@/components/ui/LaTeXEditor';
import { LatexContent } from '@/components/ui/LatexContent';
import type { Exam, Part1Question, Part2Question, Part3Question, QuestionGroup } from '@/types';
import {
    ArrowLeft, Save, Plus, Trash2, Edit3, Check,
    ChevronDown, ChevronUp, Download, Copy, Search as SearchIcon,
    X, UserPlus, Users as UsersIcon, GraduationCap as ClassIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadJSON } from '@/lib/exportUtils';
import { getAllAllowedUsers, getUniqueClasses, getUsersByClass, getBlacklist } from '@/services/auth.service';

export default function EditExamPage() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [title, setTitle] = useState('');
    const [time, setTime] = useState(50);
    const [subjectId, setSubjectId] = useState('');
    const [customFolder, setCustomFolder] = useState('');
    const [part1, setPart1] = useState<Part1Question[]>([]);
    const [part2, setPart2] = useState<Part2Question[]>([]);
    const [part3, setPart3] = useState<Part3Question[]>([]);
    const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
    
    // Special Exam state
    const [isSpecial, setIsSpecial] = useState(false);
    const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
    const [emailInput, setEmailInput] = useState('');
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [activePickerTab, setActivePickerTab] = useState<'manual' | 'system' | 'class'>('manual');
    const [pickerLoading, setPickerLoading] = useState(false);

    // Track which question is being edited
    const [editingQ, setEditingQ] = useState<{ part: number; id: number } | null>(null);

    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // Duplicate state
    const [duplicating, setDuplicating] = useState(false);

    // Collapse sections
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const subjects = getSubjects();

    useEffect(() => {
        async function load() {
            if (!examId) return;
            const data = await getExamContent(examId, true);
            if (!data) {
                toast({ title: 'Không tìm thấy đề thi', type: 'error' });
                navigate('/admin/practice');
                return;
            }
            setExam(data);
            setTitle(data.title);
            setTime(data.time);
            setSubjectId(data.subjectId);
            setCustomFolder(data.customFolder || '');
            setPart1(data.part1 || []);
            setPart2(data.part2 || []);
            setPart3(data.part3 || []);
            setQuestionGroups(data.questionGroups || []);
            setIsSpecial(data.isSpecial || false);
            setAllowedEmails(data.allowedEmails || []);
            setLoading(false);
        }
        load();
    }, [examId]);

    // Load picker data
    useEffect(() => {
        if (isSpecial) {
            loadPickerData();
        }
    }, [isSpecial]);

    const loadPickerData = async () => {
        setPickerLoading(true);
        try {
            const [users, classList, blacklist] = await Promise.all([
                getAllAllowedUsers(),
                getUniqueClasses(),
                getBlacklist()
            ]);
            
            const blacklistedEmails = (blacklist || []).map(b => b.email.toLowerCase());
            const filteredUsers = users.filter(u => !blacklistedEmails.includes(u.email.toLowerCase()));
            
            setSystemUsers(filteredUsers);
            setClasses(classList);
        } catch (err) {
            console.error('Failed to load picker data', err);
        } finally {
            setPickerLoading(false);
        }
    };

    const addEmail = (email: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || allowedEmails.includes(trimmed)) return;
        setAllowedEmails([...allowedEmails, trimmed]);
        setEmailInput('');
    };

    const removeEmail = (email: string) => {
        setAllowedEmails(allowedEmails.filter(e => e !== email));
    };

    const addByClass = async (className: string) => {
        setPickerLoading(true);
        try {
            const [users, blacklist] = await Promise.all([
                getUsersByClass(className),
                getBlacklist()
            ]);
            
            const blacklistedEmails = (blacklist || []).map(b => b.email.toLowerCase());
            const activeUsers = users.filter(u => !blacklistedEmails.includes(u.email.toLowerCase()));
            
            const emailsToAdd = activeUsers.map(u => u.email.toLowerCase());
            const newList = Array.from(new Set([...allowedEmails, ...emailsToAdd]));
            
            setAllowedEmails(newList);
            toast({ title: `Đã thêm ${emailsToAdd.length} học sinh từ lớp ${className}`, type: 'success' });
        } catch (err) {
            console.error('Failed to add by class', err);
            toast({ title: 'Lỗi khi thêm theo lớp', type: 'error' });
        } finally {
            setPickerLoading(false);
        }
    };

    const handleSave = async () => {
        if (!examId) return;
        setSaving(true);
        try {
            await updateExam(examId, { 
                title, time, subjectId, customFolder, part1, part2, part3, questionGroups,
                isSpecial, allowedEmails 
            });
            toast({ title: 'Đã lưu thành công!', type: 'success' });
        } catch (err) {
            toast({ title: 'Lỗi khi lưu', message: String(err), type: 'error' });
        }
        setSaving(false);
    };

    const handleExport = () => {
        if (!exam) return;
        const exportData = {
            ...exam,
            title,
            time,
            subjectId,
            customFolder,
            part1,
            part2,
            part3,
            questionGroups,
            updatedAt: new Date().toISOString()
        };
        downloadJSON(exportData, `StudyStation_Exam_${examId}_${new Date().toISOString().split('T')[0]}`);
        toast({ title: 'Đã xuất file JSON', type: 'success' });
    };

    const handleDuplicate = async () => {
        if (!exam) return;
        setDuplicating(true);
        try {
            const newExamId = await createExam({
                title: `${title} (Bản sao)`,
                time,
                subjectId,
                customFolder,
                part1,
                part2,
                part3,
                questionGroups,
            });
            toast({ title: 'Đã tạo bản sao thành công!', type: 'success' });
            navigate(`/admin/practice/edit/${newExamId}`);
        } catch (err) {
            toast({ title: 'Lỗi khi tạo bản sao', message: String(err), type: 'error' });
        }
        setDuplicating(false);
    };

    // ---- Part 1 helpers ----
    const addP1Question = () => {
        const newId = (part1.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part1Question = {
            id: newId,
            text: '',
            options: ['', '', '', ''],
            correct: 0,
        };
        setPart1([...part1, q]);
        setEditingQ({ part: 1, id: newId });
    };

    const removeP1Question = (id: number) => setPart1(part1.filter(q => q.id !== id));

    const updateP1 = (id: number, updates: Partial<Part1Question>) => {
        setPart1(part1.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    // ---- Part 2 helpers ----
    const addP2Question = () => {
        const newId = (part2.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part2Question = {
            id: newId,
            text: '',
            subQuestions: [
                { id: 'a', text: '', correct: false },
                { id: 'b', text: '', correct: false },
                { id: 'c', text: '', correct: false },
                { id: 'd', text: '', correct: false },
            ],
        };
        setPart2([...part2, q]);
        setEditingQ({ part: 2, id: newId });
    };

    const removeP2Question = (id: number) => setPart2(part2.filter(q => q.id !== id));

    const updateP2 = (id: number, updates: Partial<Part2Question>) => {
        setPart2(part2.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const updateP2Sub = (qId: number, subId: string, updates: { text?: string; correct?: boolean }) => {
        setPart2(part2.map(q =>
            q.id === qId
                ? { ...q, subQuestions: q.subQuestions.map(sq => sq.id === subId ? { ...sq, ...updates } : sq) }
                : q
        ));
    };

    // ---- Part 3 helpers ----
    const addP3Question = () => {
        const newId = (part3.reduce((m, q) => Math.max(m, q.id), 0)) + 1;
        const q: Part3Question = { id: newId, text: '', correct: '' };
        setPart3([...part3, q]);
        setEditingQ({ part: 3, id: newId });
    };

    const removeP3Question = (id: number) => setPart3(part3.filter(q => q.id !== id));

    const updateP3 = (id: number, updates: Partial<Part3Question>) => {
        setPart3(part3.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    // ---- Question Group helpers ----
    const addGroup = () => {
        const newId = `grp-${Date.now()}`;
        const group: QuestionGroup = {
            id: newId,
            title: '',
            passage: '',
            questionIds: []
        };
        setQuestionGroups([...questionGroups, group]);
        setEditingQ({ part: 0, id: Number(newId.split('-')[1]) }); // Hacky way to use editingQ for groups
    };

    const removeGroup = (id: string) => setQuestionGroups(questionGroups.filter(g => g.id !== id));

    const updateGroup = (id: string, updates: Partial<QuestionGroup>) => {
        setQuestionGroups(questionGroups.map(g => g.id === id ? { ...g, ...updates } : g));
    };

    const toggleQuestionInGroup = (groupId: string, qId: number) => {
        setQuestionGroups(questionGroups.map(g => {
            if (g.id !== groupId) return g;
            const exists = g.questionIds.includes(qId);
            return {
                ...g,
                questionIds: exists 
                    ? g.questionIds.filter(id => id !== qId) 
                    : [...g.questionIds, qId]
            };
        }));
    };

    const toggleCollapse = (key: string) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

    if (loading) return (
        <div className="flex justify-center py-20">
            <Spinner size="lg" label="Đang tải đề thi..." />
        </div>
    );

    if (!exam) return null;

    const isEditingQ = (part: number, id: number) => editingQ?.part === part && editingQ?.id === id;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="admin-card p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/practice')} className="rounded-full shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full text-xl font-black text-slate-800 dark:text-slate-100 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 pb-0.5 transition-colors"
                            placeholder="Tên đề thi..."
                        />
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <select
                                value={subjectId}
                                onChange={e => setSubjectId(e.target.value)}
                                className="text-xs font-bold text-slate-500 bg-transparent outline-none cursor-pointer border-none"
                            >
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                            </select>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    value={time}
                                    onChange={e => setTime(parseInt(e.target.value) || 0)}
                                    className="w-12 text-xs font-bold text-slate-500 bg-transparent outline-none border-none text-center"
                                />
                                <span className="text-xs text-slate-400">phút</span>
                            </div>
                            <span className="text-slate-300">|</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Thư mục</span>
                                <input
                                    value={customFolder}
                                    onChange={e => setCustomFolder(e.target.value)}
                                    className="min-w-[140px] text-xs font-semibold text-slate-500 bg-transparent outline-none border-b border-slate-200 focus:border-indigo-400 px-1"
                                    placeholder="VD: Ôn thi HK2"
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-medium">ID: {examId}</span>
                        </div>
                    </div>
                </div>
                <div className="flex-1 max-w-sm relative px-2">
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Tìm câu hỏi / đáp án..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" onClick={handleDuplicate} isLoading={duplicating} className="gap-2 px-4 rounded-xl border-slate-200">
                        <Copy className="h-4 w-4" /> Tạo bản sao
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="gap-2 px-4 rounded-xl border-slate-200">
                        <Download className="h-4 w-4" /> Export
                    </Button>
                    <Button onClick={handleSave} isLoading={saving} className="admin-btn-primary gap-2 px-5 rounded-xl">
                        <Save className="h-4 w-4" /> Lưu tất cả
                    </Button>
                </div>
            </div>

            {/* SPECIAL EXAM SECTION */}
            <div className="admin-card overflow-hidden">
                <div className="p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg transition-colors", isSpecial ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-800")}>
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">Đề thi đặc biệt</h3>
                            <p className="text-xs text-slate-500">Giới hạn người truy cập (chỉ những người được chọn mới thấy đề)</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsSpecial(!isSpecial)}
                        className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            isSpecial ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"
                        )}
                    >
                        <span className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            isSpecial ? "translate-x-5" : "translate-x-0"
                        )} />
                    </button>
                </div>

                {isSpecial && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Email Picker */}
                            <div className="space-y-4">
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                                    <PickerTab active={activePickerTab === 'manual'} onClick={() => setActivePickerTab('manual')} icon={Edit3} label="Nhập mail" />
                                    <PickerTab active={activePickerTab === 'system'} onClick={() => setActivePickerTab('system')} icon={UsersIcon} label="Hệ thống" />
                                    <PickerTab active={activePickerTab === 'class'} onClick={() => setActivePickerTab('class')} icon={ClassIcon} label="Theo lớp" />
                                </div>

                                {activePickerTab === 'manual' && (
                                    <div className="flex gap-2">
                                        <input 
                                            value={emailInput}
                                            onChange={e => setEmailInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addEmail(emailInput)}
                                            placeholder="Nhập email người dùng..."
                                            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                        />
                                        <Button onClick={() => addEmail(emailInput)} size="sm" className="rounded-xl">Thêm</Button>
                                    </div>
                                )}

                                {activePickerTab === 'system' && (
                                    <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                                        {pickerLoading ? <div className="p-4 text-center"><Spinner size="sm" /></div> : 
                                            systemUsers.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">Không có người dùng</p> :
                                            systemUsers.map(u => (
                                                <button 
                                                    key={u.email}
                                                    onClick={() => addEmail(u.email)}
                                                    disabled={allowedEmails.includes(u.email)}
                                                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left disabled:opacity-50"
                                                >
                                                    <span className="text-xs font-medium">{u.name || u.email} <span className="text-slate-400 font-normal">({u.email})</span></span>
                                                    {!allowedEmails.includes(u.email) && <Plus className="h-3 w-3 text-indigo-500" />}
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}

                                {activePickerTab === 'class' && (
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                        {pickerLoading ? <div className="col-span-2 p-4 text-center"><Spinner size="sm" /></div> :
                                            classes.length === 0 ? <p className="col-span-2 p-4 text-center text-xs text-slate-500">Chưa có dữ liệu lớp</p> :
                                            classes.map(c => (
                                                <button 
                                                    key={c}
                                                    onClick={() => addByClass(c)}
                                                    className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 hover:bg-indigo-50/30 text-left transition-colors"
                                                >
                                                    <span className="text-xs font-bold uppercase">{c}</span>
                                                    <UsersIcon className="h-3 w-3 text-slate-400" />
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Allowed List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Người được phép truy cập ({allowedEmails.length})</h4>
                                    {allowedEmails.length > 0 && <button onClick={() => setAllowedEmails([])} className="text-[10px] font-bold text-rose-500 hover:underline">Xóa tất cả</button>}
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                                    {allowedEmails.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Chưa chọn người dùng nào. Đề thi này sẽ hiện với KHÔNG MỘT AI (ngoại trừ Admin).</p>
                                    ) : (
                                        allowedEmails.map(email => (
                                            <div key={email} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-sm group">
                                                {email}
                                                <button onClick={() => removeEmail(email)} className="hover:text-rose-500 transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* QUESTION GROUPS (English Only) */}
            {subjectId === 'anh' && (
                <div className="admin-card overflow-hidden">
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => toggleCollapse('groups')}
                    >
                        <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 text-xs font-bold">NHÓM CÂU HỎI</span>
                            Phần bổ trợ Tiếng Anh
                            <span className="text-sm font-normal text-slate-400">({questionGroups.length} nhóm)</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={e => { e.stopPropagation(); addGroup(); }}
                                size="sm" variant="outline"
                                className="gap-1 text-xs rounded-xl h-8 border-dashed"
                            >
                                <Plus className="h-3.5 w-3.5" /> Thêm nhóm
                            </Button>
                            {collapsed['groups'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                        </div>
                    </div>

                    {!collapsed['groups'] && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {questionGroups.length === 0 && (
                                <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có nhóm — nhấn "Thêm nhóm" cho các phần Passage/Requirement</p>
                            )}
                            {questionGroups.map((group, _gIdx) => (
                                <div key={group.id} className="p-4 bg-pink-50/10">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 space-y-4">
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Yêu cầu / Chỉ dẫn</label>
                                                    <input 
                                                        value={group.title}
                                                        onChange={e => updateGroup(group.id, { title: e.target.value })}
                                                        placeholder="VD: Read the following passage and mark the letter A, B, C, or D..."
                                                        className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-pink-400 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Đoạn văn (Passage - tùy chọn)</label>
                                                    <LaTeXEditor
                                                        value={group.passage || ''}
                                                        onChange={v => updateGroup(group.id, { passage: v })}
                                                        placeholder="Nội dung đoạn văn đọc hiểu... hỗ trợ LaTeX/LatexContent"
                                                        rows={4}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Chọn các câu hỏi thuộc nhóm này (từ PHẦN 1)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {part1.map((q, p1Idx) => {
                                                        const isSelected = group.questionIds.includes(q.id);
                                                        const isUsedByOther = questionGroups.some(other => other.id !== group.id && other.questionIds.includes(q.id));
                                                        return (
                                                            <button
                                                                key={q.id}
                                                                type="button"
                                                                disabled={isUsedByOther}
                                                                onClick={() => toggleQuestionInGroup(group.id, q.id)}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                                                                    isSelected 
                                                                        ? "bg-pink-600 border-pink-600 text-white shadow-sm" 
                                                                        : isUsedByOther
                                                                            ? "bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed opacity-50"
                                                                            : "bg-white border-slate-200 text-slate-500 hover:border-pink-300"
                                                                )}
                                                            >
                                                                Câu {p1Idx + 1}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeGroup(group.id)} 
                                            className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* PART 1 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p1')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold">PHẦN 1</span>
                        Trắc nghiệm khách quan
                        <span className="text-sm font-normal text-slate-400">({part1.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP1Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p1'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p1'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part1.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi — nhấn "Thêm câu" để bắt đầu</p>
                        )}
                        {part1
                            .map((q: Part1Question, rawIdx: number) => ({ q, originalIdx: rawIdx }))
                            .filter(({ q }: { q: Part1Question }) => {
                                if (!searchTerm.trim()) return true;
                                const s = searchTerm.toLowerCase();
                                return q.text.toLowerCase().includes(s) || 
                                       q.options.some((opt: string) => opt.toLowerCase().includes(s));
                            })
                            .map(({ q, originalIdx }: { q: Part1Question, originalIdx: number }) => (
                            <div key={q.id} className="p-4">
                                {/* Question header row */}
                                <div className="flex items-start gap-2 mb-2">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {originalIdx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {isEditingQ(1, q.id) ? (
                                            <LaTeXEditor
                                                value={q.text}
                                                onChange={v => updateP1(q.id, { text: v })}
                                                placeholder="Nội dung câu hỏi... hỗ trợ LaTeX: $\frac{a}{b}$, \ce{H2O}..."
                                                rows={3}
                                                label="Câu hỏi"
                                            />
                                        ) : (
                                            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 py-1">
                                                {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(1, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 1, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP1Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Options */}
                                {isEditingQ(1, q.id) ? (
                                    <div className="ml-9 space-y-4 mt-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {q.options.map((opt, oIdx) => (
                                                <div key={oIdx} className="flex items-start gap-2 group/opt">
                                                    <label className="flex items-center gap-1.5 mt-2 cursor-pointer shrink-0">
                                                        <input
                                                            type="radio"
                                                            name={`p1-correct-${q.id}`}
                                                            checked={q.correct === oIdx}
                                                            onChange={() => updateP1(q.id, { correct: oIdx as 0 | 1 | 2 | 3 })}
                                                            className="accent-indigo-600"
                                                        />
                                                        <span className={cn(
                                                            'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                                                            q.correct === oIdx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                        )}>
                                                            {String.fromCharCode(65 + oIdx)}
                                                        </span>
                                                    </label>
                                                    <div className="flex-1 flex gap-1 items-start">
                                                        <textarea
                                                            value={opt}
                                                            onChange={e => {
                                                                const opts = [...q.options];
                                                                opts[oIdx] = e.target.value;
                                                                updateP1(q.id, { options: opts });
                                                            }}
                                                            placeholder={`Lựa chọn ${String.fromCharCode(65 + oIdx)}`}
                                                            rows={1}
                                                            className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 resize-none font-mono"
                                                        />
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => {
                                                                const opts = q.options.filter((_, i) => i !== oIdx);
                                                                let newCorrect = q.correct;
                                                                if (q.correct === oIdx) newCorrect = 0;
                                                                else if (q.correct > oIdx) newCorrect = (q.correct - 1) as any;
                                                                updateP1(q.id, { options: opts, correct: newCorrect });
                                                            }}
                                                            className="h-8 w-8 text-slate-300 hover:text-rose-500 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {q.options.length < 6 && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => updateP1(q.id, { options: [...q.options, ''] })}
                                                className="dashed-btn text-[10px] h-7 gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> Thêm đáp án
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className={cn(
                                                'flex items-start gap-2 rounded-lg px-2 py-1 text-sm',
                                                q.correct === oIdx ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-600 dark:text-slate-400'
                                            )}>
                                                <span className={cn(
                                                    'w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5',
                                                    q.correct === oIdx ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                                                )}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </span>
                                                {opt ? <LatexContent content={opt} /> : <span className="text-slate-300">—</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {searchTerm.trim() && part1.length > 0 && part1.filter((q: Part1Question) => {
                            const s = searchTerm.toLowerCase();
                            return q.text.toLowerCase().includes(s) || q.options.some((opt: string) => opt.toLowerCase().includes(s));
                        }).length === 0 && (
                            <p className="py-12 text-center text-sm text-slate-400 italic bg-slate-50/30">Không tìm thấy câu hỏi phù hợp trong Phần 1</p>
                        )}
                    </div>
                )}
            </div>

            {/* PART 2 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p2')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 text-xs font-bold">PHẦN 2</span>
                        Trắc nghiệm Đúng/Sai
                        <span className="text-sm font-normal text-slate-400">({part2.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP2Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p2'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p2'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part2.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi</p>
                        )}
                        {part2
                            .map((q: Part2Question, rawIdx: number) => ({ q, originalIdx: (part1.length) + rawIdx }))
                            .filter(({ q }: { q: Part2Question }) => {
                                if (!searchTerm.trim()) return true;
                                const s = searchTerm.toLowerCase();
                                return q.text.toLowerCase().includes(s) || 
                                       q.subQuestions.some((sq: any) => sq.text.toLowerCase().includes(s));
                            })
                            .map(({ q, originalIdx }: { q: Part2Question, originalIdx: number }) => (
                            <div key={q.id} className="p-4">
                                <div className="flex items-start gap-2 mb-3">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {originalIdx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {isEditingQ(2, q.id) ? (
                                            <LaTeXEditor
                                                value={q.text}
                                                onChange={v => updateP2(q.id, { text: v })}
                                                placeholder="Ngữ cảnh/đề câu hỏi đúng sai..."
                                                rows={2}
                                                label="Đề bài"
                                            />
                                        ) : (
                                            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 py-1">
                                                {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(2, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 2, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP2Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Sub-questions */}
                                <div className="ml-9 space-y-2">
                                    {q.subQuestions.map(sq => (
                                        <div key={sq.id} className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/30 p-2 border border-slate-100 dark:border-slate-700">
                                            <span className="uppercase font-bold text-xs text-slate-500 mt-1 w-4 shrink-0">{sq.id})</span>
                                            {isEditingQ(2, q.id) ? (
                                                <div className="flex-1 flex gap-2 items-start">
                                                    <textarea
                                                        value={sq.text}
                                                        onChange={e => updateP2Sub(q.id, sq.id, { text: e.target.value })}
                                                        placeholder="Nội dung ý..."
                                                        rows={1}
                                                        className="flex-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 resize-none font-mono"
                                                    />
                                                    <div className="flex gap-1 shrink-0 mt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateP2Sub(q.id, sq.id, { correct: true })}
                                                            className={cn('px-2 py-1 text-xs font-bold rounded-lg transition-all', sq.correct ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100')}
                                                        >Đ</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateP2Sub(q.id, sq.id, { correct: false })}
                                                            className={cn('px-2 py-1 text-xs font-bold rounded-lg transition-all', !sq.correct ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100')}
                                                        >S</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-start gap-2">
                                                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                                                        {sq.text ? <LatexContent content={sq.text} /> : <span className="text-slate-400 italic">—</span>}
                                                    </span>
                                                    <span className={cn('shrink-0 px-2 py-0.5 text-xs font-bold rounded', sq.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                                        {sq.correct ? 'Đúng' : 'Sai'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PART 3 */}
            <div className="admin-card overflow-hidden">
                <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleCollapse('p3')}
                >
                    <h3 className="font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 text-xs font-bold">PHẦN 3</span>
                        Trả lời ngắn
                        <span className="text-sm font-normal text-slate-400">({part3.length} câu)</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={e => { e.stopPropagation(); addP3Question(); }}
                            size="sm" variant="outline"
                            className="gap-1 text-xs rounded-xl h-8 border-dashed"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm câu
                        </Button>
                        {collapsed['p3'] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                    </div>
                </div>

                {!collapsed['p3'] && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {part3.length === 0 && (
                            <p className="py-8 text-center text-sm text-slate-400 italic">Chưa có câu hỏi</p>
                        )}
                        {part3
                            .map((q: Part3Question, rawIdx: number) => ({ q, originalIdx: part1.length + part2.length + rawIdx }))
                            .filter(({ q }: { q: Part3Question }) => {
                                if (!searchTerm.trim()) return true;
                                const s = searchTerm.toLowerCase();
                                return q.text.toLowerCase().includes(s) || 
                                       q.correct.toLowerCase().includes(s);
                            })
                            .map(({ q, originalIdx }: { q: Part3Question, originalIdx: number }) => (
                            <div key={q.id} className="p-4">
                                <div className="flex items-start gap-2">
                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-bold mt-0.5">
                                        {originalIdx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0 space-y-3">
                                        {isEditingQ(3, q.id) ? (
                                            <>
                                                <LaTeXEditor
                                                    value={q.text}
                                                    onChange={v => updateP3(q.id, { text: v })}
                                                    placeholder="Nội dung câu hỏi..."
                                                    rows={3}
                                                    label="Câu hỏi"
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Đáp án đúng</label>
                                                    <input
                                                        type="text"
                                                        value={q.correct}
                                                        onChange={e => updateP3(q.id, { correct: e.target.value })}
                                                        placeholder="Đáp án... (nhiều phương án ngăn cách bằng |)"
                                                        className="text-sm bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-400 font-mono"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                                    {q.text ? <LatexContent content={q.text} /> : <span className="text-slate-400 italic">(chưa có nội dung)</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-slate-400 font-semibold">Đáp án:</span>
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                                        {q.correct || '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditingQ(3, q.id) ? (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ(null)} className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => setEditingQ({ part: 3, id: q.id })} className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg">
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => removeP3Question(q.id)} className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Sticky save bar */}
            <div className="sticky bottom-4 z-20 flex justify-center">
                <div className="admin-card px-6 py-3 flex items-center gap-4">
                    <span className="text-sm text-slate-500 font-medium">
                        Tổng: <strong className="text-slate-800 dark:text-slate-200">{part1.length + part2.length + part3.length}</strong> câu
                    </span>
                    <Button onClick={handleSave} isLoading={saving} className="admin-btn-primary gap-2 px-5 rounded-xl">
                        <Save className="h-4 w-4" /> Lưu tất cả thay đổi
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PickerTab({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                active ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
        >
            <Icon className="h-3 w-3" /> {label}
        </button>
    );
}
