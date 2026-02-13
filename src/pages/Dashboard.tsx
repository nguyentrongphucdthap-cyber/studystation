import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        {
            label: 'Bài thi',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            color: 'bg-blue-100 text-blue-600',
            onClick: () => navigate('/practice'),
        },
        {
            label: 'Thời Khoá Biểu',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            color: 'bg-green-100 text-green-600',
            onClick: () => { /* Coming soon */ },
            comingSoon: true,
        },
        {
            label: 'Lịch thi',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: 'bg-red-100 text-red-600',
            onClick: () => { /* Coming soon */ },
            comingSoon: true,
        },
        {
            label: 'Tài liệu',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                </svg>
            ),
            color: 'bg-indigo-100 text-indigo-600',
            onClick: () => { /* Coming soon */ },
            comingSoon: true,
        },
        {
            label: 'E-test',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707" />
                </svg>
            ),
            color: 'bg-purple-100 text-purple-600',
            onClick: () => navigate('/etest'),
        },
        {
            label: 'Flashcard',
            icon: (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            ),
            color: 'bg-yellow-100 text-yellow-600',
            onClick: () => navigate('/vocab'),
        },
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 md:mb-6">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
                    Study<span className="text-blue-400">Station</span>
                </h1>
                <p className="text-base md:text-lg text-gray-600 mt-2 md:mt-0">
                    Xin chào{user?.displayName ? `, ${user.displayName.split(' ').pop()}` : ''}, hãy chọn một mục để bắt đầu!
                </p>
            </div>

            {/* 3x2 Grid Menu */}
            <div className="grid grid-cols-3 gap-4 md:gap-6">
                {menuItems.map((item) => (
                    <button
                        key={item.label}
                        onClick={item.onClick}
                        className="menu-card p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-500 aspect-square"
                    >
                        <div className="flex flex-col items-center justify-center h-full space-y-2 text-center">
                            <div className={`p-3 rounded-full ${item.color}`}>
                                {item.icon}
                            </div>
                            <span className="text-sm md:text-xl font-semibold text-gray-800">
                                {item.label}
                            </span>
                            {item.comingSoon && (
                                <span className="text-[10px] text-gray-400 font-medium">Sắp ra mắt</span>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
