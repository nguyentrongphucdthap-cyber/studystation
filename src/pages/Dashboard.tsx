import { useNavigate } from 'react-router-dom';

const menuItems = [
    {
        label: 'Bài Thi',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        iconBg: 'bg-red-100 text-red-500',
        path: '/practice',
    },
    {
        label: 'Thời Khóa Biểu',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
        iconBg: 'bg-indigo-100 text-indigo-500',
        path: '/schedule',
    },
    {
        label: 'Tài Liệu',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        ),
        iconBg: 'bg-yellow-100 text-yellow-600',
        path: '',
        soon: true,
    },
    {
        label: 'Flashcard',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
        ),
        iconBg: 'bg-yellow-100 text-yellow-600',
        path: '/vocab',
    },
    {
        label: 'E-test',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
        iconBg: 'bg-blue-100 text-blue-500',
        badge: 'EN',
        path: '/etest',
    },
];

export default function Dashboard() {
    const navigate = useNavigate();

    return (
        <div>
            {/* 3-column grid — first row */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-3 md:mb-4">
                {menuItems.slice(0, 3).map((item) => (
                    <MenuCard key={item.label} item={item} onClick={() => item.path && navigate(item.path)} />
                ))}
            </div>
            {/* 2-column row — left-aligned with first 2 columns */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {menuItems.slice(3).map((item) => (
                    <MenuCard key={item.label} item={item} onClick={() => item.path && navigate(item.path)} />
                ))}
                <div /> {/* spacer */}
            </div>
        </div>
    );
}

interface MenuCardProps {
    item: typeof menuItems[0];
    onClick: () => void;
}

function MenuCard({ item, onClick }: MenuCardProps) {
    return (
        <button
            onClick={onClick}
            disabled={item.soon}
            className={`
                group relative rounded-[32px] p-6 md:p-10
                flex flex-col items-center justify-center aspect-[10/9]
                transition-all duration-500 var(--cubic-out)
                border border-white
                bg-white/80 backdrop-blur-xl
                shadow-soft hover:shadow-heavy hover:-translate-y-2 hover:bg-white
                active:scale-[0.96]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-soft
            `}
        >
            {/* Icon container */}
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[22px] ${item.iconBg} flex items-center justify-center mb-4 md:mb-5 relative transition-all duration-500 group-hover:scale-110 shadow-sm group-hover:shadow-md`}>
                <div className="scale-110">{item.icon}</div>
                {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        {item.badge}
                    </span>
                )}
            </div>

            {/* Label */}
            <span className="text-[15px] md:text-[17px] font-extrabold text-gray-900 dark:text-gray-100 transition-colors group-hover:text-blue-600 tracking-tight">{item.label}</span>

            {/* Soon badge */}
            {item.soon && (
                <div className="absolute bottom-4 px-3 py-1 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-200 dark:border-gray-700">
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">Coming Soon</span>
                </div>
            )}
        </button>
    );
}
