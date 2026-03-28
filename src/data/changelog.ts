export interface ChangelogEntry {
    hash: string;
    date: string;
    message: string;
    type: 'feat' | 'fix' | 'style' | 'docs' | 'refactor' | 'perf' | 'test' | 'chore' | 'other';
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        "hash": "1a59873",
        "date": "2026-03-28",
        "message": "Tính năng: Thống kê chi tiết việc học từ vựng, theo dõi thói quen học tập và thiết lập giới hạn 10 câu hỏi/ngày cho Mago AI để hệ thống luôn ổn định.",
        "type": "feat"
    },
    {
        "hash": "2ffb14f",
        "date": "2026-03-28",
        "message": "Tính năng: Nâng cấp Mago AI mạnh mẽ hơn, hỗ trợ hiển thị mọi công thức Toán, Lý, Hóa một cách chuyên nghiệp và đẹp mắt.",
        "type": "feat"
    },
    {
        "hash": "79bac98",
        "date": "2026-03-28",
        "message": "Tính năng: Cải tiến trí thông minh của Mago AI, hỗ trợ trình bày văn bản (chữ đậm, nghiêng, danh sách) giúp nội dung phản hồi dễ đọc và sinh động hơn.",
        "type": "feat"
    },
    {
        "hash": "fd4a84e",
        "date": "2026-03-28",
        "message": "Hệ thống: Xây dựng lớp bảo mật trung gian cho trí tuệ nhân tạo, giúp ứng dụng hoạt động ổn định, bảo mật và bền bỉ hơn.",
        "type": "chore"
    },
    {
        "hash": "836fd52",
        "date": "2026-03-26",
        "message": "Giao diện: Thay áo mới cho màn hình chờ với hiệu ứng lật sách 3D và vòng xoay hiện đại, mang lại cảm giác cao cấp khi khởi động.",
        "type": "style"
    },
    {
        "hash": "197e129",
        "date": "2026-03-26",
        "message": "Giao diện: Tối ưu hóa cảm giác vuốt thẻ Flashcard mượt mà như 'nước lỏng', giúp việc ôn tập từ vựng không còn nhàm chán.",
        "type": "style"
    },
    {
        "hash": "4f988d2",
        "date": "2026-03-26",
        "message": "Sửa lỗi: Khắc phục sự cố không mở được tài liệu PDF trên một số thiết bị, đảm bảo tài liệu luôn sẵn sàng để cậu nghiên cứu.",
        "type": "fix"
    },
    {
        "hash": "0f6fed1",
        "date": "2026-03-24",
        "message": "Tính năng: 'Đại tu' hệ thống Flashcard với logic học tập mới, trò chơi nối từ vui nhộn và chế độ tự động chuyển bài thông minh.",
        "type": "feat"
    },
    {
        "hash": "eb541a8",
        "date": "2026-03-20",
        "message": "Quản trị: Bổ sung công cụ quản lý học sinh theo lớp, tính năng danh sách đen và nâng cấp biểu đồ thống kê dành cho giáo viên.",
        "type": "feat"
    },
    {
        "hash": "a4bf659",
        "date": "2026-03-18",
        "message": "Giao diện: Tối ưu hóa khu vực làm bài thi trên điện thoại, tự động ẩn các thanh công cụ để cậu tập trung tối đa khi làm bài.",
        "type": "style"
    },
    {
        "hash": "3b38d4b",
        "date": "2026-03-18",
        "message": "Giao diện: Làm mới hoàn toàn thẻ bài thi với hiệu ứng phát sáng và màu sắc thay đổi theo điểm số, giúp cậu dễ dàng nhận biết kết quả.",
        "type": "style"
    },
    {
        "hash": "f6a94da",
        "date": "2026-03-17",
        "message": "Quản trị: Cải tiến bộ lọc tìm kiếm học sinh, ưu tiên sắp xếp theo lớp học để giáo viên dễ dàng theo dõi tình hình học tập.",
        "type": "feat"
    },
    {
        "hash": "3a1f7eb",
        "date": "2026-03-17",
        "message": "Quản trị: Thêm tính năng nhân bản bài thi và tìm kiếm nhanh trong bộ soạn thảo, giúp tiết kiệm thời gian tạo đề bài.",
        "type": "feat"
    },
    {
        "hash": "9d0862c",
        "date": "2026-03-17",
        "message": "Giao diện: Tinh chỉnh chế độ luyện tập, thay đổi vị trí mục lục và làm lại biểu đồ điểm số để cậu nhìn rõ tiến độ của mình hơn.",
        "type": "style"
    },
    {
        "hash": "6775dc8",
        "date": "2026-03-17",
        "message": "Sửa lỗi: Cải thiện khả năng đọc công thức hóa học của AI, giúp quá trình nhập đề thi tự động diễn ra chính xác tuyệt đối.",
        "type": "fix"
    },
    {
        "hash": "16a8368",
        "date": "2026-03-16",
        "message": "Tính năng: Thêm bảng lịch thi chi tiết ngay tại màn hình chọn bài, giúp cậu không bao giờ bỏ lỡ các kỳ thi quan trọng.",
        "type": "feat"
    },
    {
        "hash": "51bcfbd",
        "date": "2026-03-16",
        "message": "Hệ thống: AI giờ đây đã thông minh hơn trong việc tự động nhóm các bài thi cùng loại và làm nổi bật các bài thi sắp diễn ra.",
        "type": "chore"
    },
    {
        "hash": "f9fd051",
        "date": "2026-03-16",
        "message": "Tính năng: Theo dõi lịch sử hoạt động của học sinh và làm lại thanh công cụ bài thi giúp thao tác nhanh hơn ngay cả trên di động.",
        "type": "feat"
    },
    {
        "hash": "10d83a1",
        "date": "2026-03-16",
        "message": "Hệ thống: Nâng cấp phiên bản STUDYSTATION v1.1 với các tùy chọn bài thi linh hoạt hơn (xáo trộn câu hỏi, làm lại bài).",
        "type": "chore"
    },
    {
        "hash": "cdb19fe",
        "date": "2026-03-16",
        "message": "Hệ thống: Nâng cấp bộ não AI để nhận diện các bảng biểu và hình ảnh phức tạp trong tài liệu một cách chuẩn xác nhất.",
        "type": "chore"
    },
    {
        "hash": "3470800",
        "date": "2026-03-16",
        "message": "Quản trị: Thêm vai trò Giáo viên (Teacher), hỗ trợ quản lý lớp học và giới hạn quyền truy cập cho phù hợp với từng vai trò.",
        "type": "feat"
    },
    {
        "hash": "06593f4",
        "date": "2026-03-16",
        "message": "Giao diện: Thêm nút xem đáp án chi tiết sau khi nộp bài, giúp cậu rút kinh nghiệm ngay sau khi luyện tập.",
        "type": "style"
    },
    {
        "hash": "8b8af41",
        "date": "2026-02-25",
        "message": "Tính năng: Hỗ trợ hiển thị công thức Toán học trong ô chat và cập nhật 'bộ nhớ' cho Mago AI về toàn bộ dự án StudyStation.",
        "type": "feat"
    },
    {
        "hash": "aa129cb",
        "date": "2026-02-25",
        "message": "Hệ thống: Thêm hiển thị phiên bản app, cơ chế tự động thử lại khi AI lỗi và sửa lỗi mời thành viên vào nhóm chat.",
        "type": "chore"
    },
    {
        "hash": "08b424b",
        "date": "2026-02-19",
        "message": "Tính năng: Thiết kế lại toàn bộ hệ thống Chat, chuyển dữ liệu lên đám mây Firestore và nâng cấp Mago AI vượt trội.",
        "type": "feat"
    },
    {
        "hash": "7f29d28",
        "date": "2026-02-13",
        "message": "Giao diện: Thay đổi diện mạo mục Luyện tập và trau chuốt lại bảng điều khiển Dashboard cho chuyên nghiệp hơn.",
        "type": "style"
    },
    {
        "hash": "92a153a",
        "date": "2026-02-13",
        "message": "Hệ thống: Khôi phục giao diện StudyStation nguyên bản với bố cục thẻ, đăng nhập Google và lưới menu 3x2 quen thuộc.",
        "type": "chore"
    },
    {
        "hash": "cf8411a",
        "date": "2026-02-12",
        "message": "Hệ thống: Tối ưu hóa cấu hình máy chủ đám mây để đảm bảo ứng dụng luôn chạy nhanh nhất tại Việt Nam.",
        "type": "chore"
    },
    {
        "hash": "8ed79d4",
        "date": "2026-02-12",
        "message": "Khởi tạo: Đặt những viên gạch đầu tiên cho dự án Chuyển đổi StudyStation lên nền tảng React 2.0 hiện đại.",
        "type": "chore"
    }
];
