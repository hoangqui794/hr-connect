export interface IndustryTaxonomyNode {
  value: string;
  title: string;
  enTitle?: string;
  children?: IndustryTaxonomyNode[];
  isLeaf?: boolean;
}

/**
 * 8 Nhóm Ngành Lớn chuẩn hóa theo tiêu chuẩn thị trường tuyển dụng Việt Nam (Aniday / LinkedIn)
 * - Nhóm Ngành Lớn & Nhóm Ngành Con (L1/L2 Categories): Dịch tiếng Việt tự nhiên, chuyên nghiệp.
 * - Mã value: Giữ nguyên để khớp hệ thống lọc dữ liệu và API Backend.
 */
export const VIETNAMESE_INDUSTRY_TAXONOMY: IndustryTaxonomyNode[] = [
  {
    value: 'technology',
    title: 'Công nghệ thông tin & Phần mềm',
    enTitle: 'Technology & Software',
    children: [
      { value: 'tech-software', title: 'Phát triển Phần mềm', isLeaf: true },
      { value: 'tech-it-services', title: 'Dịch vụ CNTT & Tư vấn Giải pháp', isLeaf: true },
      { value: 'tech-cloud', title: 'Điện toán Đám mây (Cloud Computing)', isLeaf: true },
      { value: 'tech-ai', title: 'Trí tuệ Nhân tạo & Học máy (AI / ML)', isLeaf: true },
      { value: 'tech-cybersecurity', title: 'An toàn Thông tin & An ninh Mạng', isLeaf: true },
      { value: 'tech-data', title: 'Hạ tầng Dữ liệu Lớn & Phân tích (Big Data)', isLeaf: true },
      { value: 'tech-blockchain', title: 'Blockchain & Web3', isLeaf: true },
      { value: 'tech-iot', title: 'Internet Vạn vật (IoT)', isLeaf: true },
      { value: 'tech-hardware', title: 'Sản xuất Phần cứng & Thiết bị Điện tử', isLeaf: true },
      { value: 'tech-semiconductor', title: 'Công nghệ Bán dẫn & Vi mạch', isLeaf: true },
      { value: 'tech-telecom', title: 'Viễn thông & Mạng di động', isLeaf: true },
      { value: 'tech-mobile', title: 'Phát triển Ứng dụng Di động (Mobile Apps)', isLeaf: true },
      { value: 'tech-gaming', title: 'Lập trình & Phát hành Game', isLeaf: true },
      { value: 'tech-saas', title: 'Phần mềm Dịch vụ (SaaS B2B/B2C)', isLeaf: true },
      { value: 'tech-ecommerce', title: 'Nền tảng Thương mại Điện tử', isLeaf: true },
      { value: 'tech-fintech', title: 'Công nghệ Tài chính (FinTech)', isLeaf: true },
      { value: 'tech-edtech', title: 'Công nghệ Giáo dục (EdTech)', isLeaf: true },
      { value: 'tech-healthtech', title: 'Công nghệ Y tế (HealthTech)', isLeaf: true },
      { value: 'tech-proptech', title: 'Công nghệ Bất động sản (PropTech)', isLeaf: true },
      { value: 'tech-hrtech', title: 'Công nghệ Nhân sự (HRTech)', isLeaf: true },
      { value: 'tech-martech', title: 'Công nghệ Tiếp thị (MarTech)', isLeaf: true },
    ],
  },
  {
    value: 'finance',
    title: 'Tài chính & Ngân hàng',
    enTitle: 'Finance & Banking',
    children: [
      { value: 'fin-banking', title: 'Ngân hàng Thương mại & Bán lẻ', isLeaf: true },
      { value: 'fin-investment', title: 'Quản lý Đầu tư & Chứng khoán', isLeaf: true },
      { value: 'fin-insurance', title: 'Bảo hiểm Nhân thọ & Phi nhân thọ', isLeaf: true },
      { value: 'fin-capital-markets', title: 'Thị trường Vốn & Môi giới', isLeaf: true },
      { value: 'fin-venture', title: 'Quỹ Đầu tư Mạo hiểm (VC & PE)', isLeaf: true },
      { value: 'fin-accounting', title: 'Kế toán & Tài chính Doanh nghiệp', isLeaf: true },
      { value: 'fin-audit', title: 'Kiểm toán & Tuân thủ Pháp lý', isLeaf: true },
      { value: 'fin-credit', title: 'Dịch vụ Tín dụng & Cho vay', isLeaf: true },
      { value: 'fin-wealth', title: 'Quản lý Tài sản Cá nhân cao cấp', isLeaf: true },
      { value: 'fin-payments', title: 'Cổng Thanh toán & Ví Điện tử', isLeaf: true },
      { value: 'fin-leasing', title: 'Cho thuê Tài chính', isLeaf: true },
      { value: 'fin-microfinance', title: 'Tài chính Vi mô', isLeaf: true },
    ],
  },
  {
    value: 'healthcare',
    title: 'Y tế & Chăm sóc sức khỏe',
    enTitle: 'Healthcare & Life Sciences',
    children: [
      { value: 'hc-hospitals', title: 'Bệnh viện & Hệ thống Phòng khám', isLeaf: true },
      { value: 'hc-pharma', title: 'Dược phẩm & Phát triển Thuốc', isLeaf: true },
      { value: 'hc-biotech', title: 'Công nghệ Sinh học', isLeaf: true },
      { value: 'hc-devices', title: 'Thiết bị & Dụng cụ Y tế', isLeaf: true },
      { value: 'hc-wellness', title: 'Chăm sóc Sức khỏe & Thể chất', isLeaf: true },
      { value: 'hc-mental', title: 'Sức khỏe Tinh thần & Tâm lý', isLeaf: true },
      { value: 'hc-dental', title: 'Nha khoa Chuyên sâu', isLeaf: true },
      { value: 'hc-veterinary', title: 'Thú y & Chăm sóc Thú cưng', isLeaf: true },
      { value: 'hc-diagnostics', title: 'Xét nghiệm & Chẩn đoán Hình ảnh', isLeaf: true },
      { value: 'hc-research', title: 'Nghiên cứu Lâm sàng', isLeaf: true },
    ],
  },
  {
    value: 'manufacturing',
    title: 'Sản xuất & Công nghiệp',
    enTitle: 'Manufacturing & Industrial',
    children: [
      { value: 'mfg-automotive', title: 'Sản xuất Ô tô & Xe điện (EV)', isLeaf: true },
      { value: 'mfg-aerospace', title: 'Hàng không Vũ trụ & Quốc phòng', isLeaf: true },
      { value: 'mfg-chemicals', title: 'Hóa chất & Vật liệu Công nghiệp', isLeaf: true },
      { value: 'mfg-machinery', title: 'Cơ khí Chế tạo & Máy móc Công nghiệp', isLeaf: true },
      { value: 'mfg-electronics', title: 'Lắp ráp Điện tử & Linh kiện EMS', isLeaf: true },
      { value: 'mfg-materials', title: 'Vật liệu Xây dựng & Kim loại', isLeaf: true },
      { value: 'mfg-plastics', title: 'Nhựa & Cao su Kỹ thuật', isLeaf: true },
      { value: 'mfg-packaging', title: 'Bao bì & Đóng gói Công nghiệp', isLeaf: true },
      { value: 'mfg-textiles', title: 'Dệt may & Da giày Xuất khẩu', isLeaf: true },
      { value: 'mfg-furniture', title: 'Chế biến Gỗ & Nội thất', isLeaf: true },
      { value: 'mfg-automation', title: 'Tự động hóa & Robot Công nghiệp', isLeaf: true },
    ],
  },
  {
    value: 'retail',
    title: 'Bán lẻ & Hàng tiêu dùng',
    enTitle: 'Retail & Consumer Goods',
    children: [
      { value: 'ret-fmcg', title: 'Hàng Tiêu dùng Nhanh (FMCG)', isLeaf: true },
      { value: 'ret-apparel', title: 'Thời trang, Giày dép & Phụ kiện', isLeaf: true },
      { value: 'ret-food-bev', title: 'Thực phẩm & Đồ uống (F&B)', isLeaf: true },
      { value: 'ret-supermarkets', title: 'Chuỗi Siêu thị & Cửa hàng Tiện lợi', isLeaf: true },
      { value: 'ret-luxury', title: 'Hàng Hiệu & Đồ Xa xỉ', isLeaf: true },
      { value: 'ret-appliances', title: 'Điện máy & Thiết bị Gia dụng', isLeaf: true },
      { value: 'ret-cosmetics', title: 'Mỹ phẩm & Chăm sóc Cá nhân', isLeaf: true },
      { value: 'ret-hospitality', title: 'Khách sạn, Nhà hàng & Dịch vụ Ăn uống', isLeaf: true },
      { value: 'ret-travel', title: 'Du lịch & Lữ hành', isLeaf: true },
    ],
  },
  {
    value: 'real-estate',
    title: 'Bất động sản & Xây dựng',
    enTitle: 'Real Estate & Construction',
    children: [
      { value: 're-development', title: 'Phát triển & Đầu tư Bất động sản', isLeaf: true },
      { value: 're-residential', title: 'Bất động sản Nhà ở & Chung cư', isLeaf: true },
      { value: 're-commercial', title: 'Bất động sản Thương mại & Văn phòng', isLeaf: true },
      { value: 're-industrial', title: 'Bất động sản Công nghiệp & Kho vận', isLeaf: true },
      { value: 're-construction', title: 'Xây dựng Dân dụng & Công nghiệp', isLeaf: true },
      { value: 're-architecture', title: 'Kiến trúc & Thiết kế Nội thất', isLeaf: true },
      { value: 're-civil-eng', title: 'Kỹ thuật Công trình & Cầu đường', isLeaf: true },
      { value: 're-property-mgmt', title: 'Quản lý & Vận hành Tòa nhà', isLeaf: true },
    ],
  },
  {
    value: 'education',
    title: 'Giáo dục & Đào tạo',
    enTitle: 'Education & Training',
    children: [
      { value: 'edu-higher', title: 'Đại học & Cao đẳng', isLeaf: true },
      { value: 'edu-k12', title: 'Giáo dục Phổ thông (K-12 & Trường Quốc tế)', isLeaf: true },
      { value: 'edu-tech-training', title: 'Đào tạo Lập trình & CNTT Chuyên sâu', isLeaf: true },
      { value: 'edu-vocational', title: 'Đào tạo Kỹ năng Nghề & Chứng chỉ', isLeaf: true },
      { value: 'edu-e-learning', title: 'Đào tạo Trực tuyến (E-Learning)', isLeaf: true },
      { value: 'edu-languages', title: 'Trung tâm Ngoại ngữ & Du học', isLeaf: true },
      { value: 'edu-publishing', title: 'Xuất bản Học liệu & Giáo trình', isLeaf: true },
    ],
  },
  {
    value: 'media',
    title: 'Truyền thông & Sáng tạo',
    enTitle: 'Media, Entertainment & Creative',
    children: [
      { value: 'med-advertising', title: 'Quảng cáo & Digital Marketing Agency', isLeaf: true },
      { value: 'med-pr', title: 'Quan hệ Công chúng (PR) & Truyền thông Doanh nghiệp', isLeaf: true },
      { value: 'med-broadcast', title: 'Truyền hình & Sản xuất Phim ảnh', isLeaf: true },
      { value: 'med-digital-content', title: 'Sáng tạo Nội dung Số & Mạng xã hội', isLeaf: true },
      { value: 'med-publishing', title: 'Báo chí & Xuất bản Điện tử', isLeaf: true },
      { value: 'med-graphic-design', title: 'Thiết kế Đồ họa & Thương hiệu', isLeaf: true },
      { value: 'med-music', title: 'Âm nhạc & Giải trí Âm thanh', isLeaf: true },
      { value: 'med-events', title: 'Tổ chức Sự kiện & Triển lãm', isLeaf: true },
    ],
  },
];

export const INDUSTRY_TAXONOMY = VIETNAMESE_INDUSTRY_TAXONOMY;
