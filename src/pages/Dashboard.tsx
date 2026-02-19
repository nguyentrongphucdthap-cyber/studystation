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
                group relative rounded-2xl p-5 md:p-7
                flex flex-col items-center justify-center aspect-[11/9]
                transition-all duration-300
                border border-white/10
                bg-white/10 backdrop-blur-sm
                hover:bg-white/25 hover:border-white/40 hover:scale-[1.05] hover:shadow-[0_12px_40px_rgba(255,255,255,0.15)]
                active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-white/10 disabled:hover:shadow-none disabled:hover:border-white/10
            `}
        >
            {/* Icon circle */}
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full ${item.iconBg} flex items-center justify-center mb-3 md:mb-4 relative transition-transform duration-300 group-hover:scale-110`}>
                {item.icon}
                {item.badge && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                    </span>
                )}
            </div>
            {/* Label */}
            <span className="text-sm md:text-base font-semibold text-white/90 transition-colors group-hover:text-white">{item.label}</span>

            {/* Soon */}
            {item.soon && (
                <span className="absolute bottom-3 text-[9px] text-white/40 font-medium">Sắp ra mắt</span>
            )}
        </button>
    );
}
