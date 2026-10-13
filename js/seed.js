// Dữ liệu mẫu cho chế độ DEMO — tên người là hư cấu.
import { uid, todayStr, addDays, eachDay, weekday, recursOn, routineAppliesTo, isWorkday, DEFAULT_SETTINGS, weekStart } from './util.js';

export const PEOPLE = [
  { id: 'u_admin', full_name: 'Nguyễn Văn Quản', role: 'admin', dept: null, title: 'Giám đốc', notify: { push: true, telegram: true } },
  { id: 'u_mai', full_name: 'Nguyễn Mai Anh', role: 'staff', dept: 'd_sales', title: 'Tư vấn bán hàng showroom', emp_type: 'fulltime', notify: { push: true, telegram: false } },
  { id: 'u_kiet', full_name: 'Lê Tuấn Kiệt', role: 'manager', dept: 'd_tech', title: 'Trưởng nhóm Kỹ thuật', emp_type: 'field', notify: { push: false, telegram: true } },
  { id: 'u_bao', full_name: 'Trần Quốc Bảo', role: 'staff', dept: 'd_mkt', title: 'Vận hành sàn TMĐT', emp_type: 'fulltime', notify: { push: true, telegram: true } },
  { id: 'u_ha', full_name: 'Phạm Thu Hà', role: 'staff', dept: 'd_dealer', title: 'Kinh doanh đại lý', emp_type: 'fulltime', notify: { push: true, telegram: false } },
  { id: 'u_bod', full_name: 'Cổ đông', role: 'bod', dept: null, title: 'Chỉ xem', notify: { push: true, telegram: false } },
];

const R = (o) => ({ id: uid(), active: true, priority: 'mid', scope: 'work', ...o });
const ROUTINES = [
  // Giám đốc
  R({ title: 'Xem doanh số hôm qua & lịch lắp đặt hôm nay', owner_id: 'u_admin', repeat: 'daily', time: '08:45', priority: 'high' }),
  R({ title: 'Duyệt báo cáo ngày của team', owner_id: 'u_admin', repeat: 'daily', time: '17:30', priority: 'high' }),
  // Sales showroom & online
  R({ id: 'r_lead', title: 'Trả lời tin nhắn Fanpage, Zalo, hotline tồn đêm', dept: 'd_sales', repeat: 'daily', time: '08:45', kpi_key: 'leads', priority: 'high' }),
  R({ title: 'Gọi lại khách đã báo giá chưa chốt', dept: 'd_sales', repeat: 'daily', time: '10:00', priority: 'high' }),
  R({ id: 'r_quote', title: 'Gửi báo giá combo theo nhu cầu khách', dept: 'd_sales', repeat: 'daily', time: '14:00', kpi_key: 'quotes_sent' }),
  R({ title: 'Cập nhật khách & đơn vào CRM', dept: 'd_sales', repeat: 'daily', time: '17:00' }),
  // Sàn TMĐT & Marketing
  R({ title: 'Xử lý đơn mới & tin nhắn Shopee / Lazada / TikTok Shop', dept: 'd_mkt', repeat: 'daily', time: '08:45', priority: 'high' }),
  R({ title: 'Trả lời đánh giá & bình luận', dept: 'd_mkt', repeat: 'daily', time: '11:00' }),
  R({ id: 'r_post', title: 'Đăng bài / video (Fanpage, TikTok)', dept: 'd_mkt', repeat: 'daily', time: '15:00', kpi_key: 'posts' }),
  R({ title: 'Nhập số đơn & doanh thu sàn trong ngày', dept: 'd_mkt', repeat: 'daily', time: '17:00', priority: 'high' }),
  // Kỹ thuật lắp đặt & bảo hành
  R({ title: 'Nhận lịch lắp đặt & kiểm hàng trước khi đi', dept: 'd_tech', repeat: 'daily', time: '08:30', priority: 'high' }),
  R({ title: 'Chụp ảnh bàn giao & cập nhật CRM sau mỗi lịch lắp', dept: 'd_tech', repeat: 'daily', time: '16:30' }),
  R({ title: 'Xử lý phiếu bảo hành đang mở', dept: 'd_tech', repeat: 'daily', time: '14:00' }),
  // Kinh doanh đại lý
  R({ id: 'r_dealer', title: 'Gọi chăm sóc đại lý theo danh sách', dept: 'd_dealer', repeat: 'daily', time: '09:30', kpi_key: 'dealers_contacted' }),
  R({ title: 'Tìm & liên hệ đại lý tiềm năng mới', dept: 'd_dealer', repeat: 'weekdays', days: [1, 3, 5], time: '14:00' }),
  R({ title: 'Đối chiếu công nợ đại lý', dept: 'd_dealer', repeat: 'weekdays', days: [6], time: '10:00' }),
  // Kho, giao vận & kế toán
  R({ title: 'Xuất kho cho lịch lắp & đơn giao hôm nay', dept: 'd_ops', repeat: 'daily', time: '08:30', priority: 'high' }),
  R({ title: 'Nhập phiếu nhập / xuất & đối chiếu tồn', dept: 'd_ops', repeat: 'daily', time: '16:30' }),
];

const K = (o) => ({ id: uid(), type: 'count', period: 'week', active: true, manual: {}, ...o });
function makeKpis() {
  return [
    K({ key: 'leads', title: 'Khách hỏi mới tiếp nhận', owner_id: 'u_mai', target: 60, unit: 'khách' }),
    K({ key: 'quotes_sent', title: 'Báo giá đã gửi', owner_id: 'u_mai', target: 25, unit: 'báo giá' }),
    K({ key: 'posts', title: 'Bài đăng / video mới', owner_id: 'u_bao', target: 20, unit: 'bài' }),
    K({ key: 'mkt_orders', title: 'Đơn sàn trong tháng', owner_id: 'u_bao', target: 150, unit: 'đơn', period: 'month' }),
    K({ key: 'dealers_contacted', title: 'Đại lý được chăm sóc', owner_id: 'u_ha', target: 40, unit: 'đại lý' }),
    K({ key: 'dealers_new', title: 'Đại lý mới ký', owner_id: 'u_ha', target: 3, unit: 'đại lý', period: 'month' }),
    K({ key: 'installs', title: 'Lịch lắp đặt hoàn thành', owner_id: 'u_kiet', target: 25, unit: 'lịch', period: 'month' }),
  ];
}

// Hồ sơ "tính cách" để dữ liệu mẫu trông thật: giờ đến & tỉ lệ hoàn thành
const PROFILE = {
  u_admin: { start: [490, 515], done: 0.9 },
  u_mai: { start: [492, 511], done: 0.92, late: 0.1 },
  u_kiet: { start: [505, 540], done: 0.75, late: 0.55 },
  u_bao: { start: [505, 520], done: 0.85, late: 0.2 },
  u_ha: { start: [494, 512], done: 0.88, late: 0.15 },
};
let seedN = 7;
const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const iso = (date, mins) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60).toISOString();
};

export function instantiateRoutines(state, p, date) {
  if (!isWorkday(state, p.id, date)) return [];
  const out = [];
  for (const r of state.routines) {
    if (!routineAppliesTo(r, p) || !recursOn(r, date)) continue;
    if (state.tasks.some((t) => t.routine_id === r.id && t.owner_id === p.id && t.date === date)) continue;
    const kpi = r.kpi_key && state.kpis.find((k) => k.key === r.kpi_key && k.owner_id === p.id);
    out.push({
      id: uid(), owner_id: p.id, title: r.title, date, time: r.time || null, end_time: r.end_time || null,
      source: r.kind === 'meeting' ? 'meeting' : 'routine', routine_id: r.id, scope: r.scope || 'work', group: r.group || null,
      priority: r.priority || 'mid', status: 'todo', progress: 0, kpi_id: kpi ? kpi.id : null, created_at: iso(date, 480),
    });
  }
  return out;
}

const ADHOC = {
  d_sales: ['Tư vấn combo karaoke gia đình cho khách Long Biên', 'Gửi báo giá BBS8 Pro Full Option', 'Hẹn khách xem demo tại showroom', 'Gọi lại khách hỏi loa iCON-9'],
  d_mkt: ['Lên lịch livestream cuối tuần', 'Chỉnh ảnh sản phẩm iCON lên sàn', 'Chạy mã giảm giá Shopee', 'Quay video lắp đặt tại nhà khách'],
  d_tech: ['Lắp combo BBS8 Pro tại nhà khách', 'Cân chỉnh vang số cho khách cũ', 'Kiểm tra loa bảo hành bị rè', 'Đi dây âm tường phòng khách'],
  d_dealer: ['Gửi chính sách đại lý cho cửa hàng ở Nam Định', 'Chốt đơn nhập tháng cho đại lý Bắc Ninh', 'Nhắc công nợ đại lý Hải Phòng', 'Gửi catalogue BBS iCON cho đại lý mới'],
  d_ops: ['Kiểm kê kho loa BBS', 'Đặt xe giao hàng tỉnh', 'Đối chiếu phiếu thu tuần'],
  admin: ['Duyệt giá bán lô hàng mới', 'Họp với đối tác BBS', 'Xem báo cáo doanh số tuần', 'Phỏng vấn ứng viên kỹ thuật'],
};

export function makeSeed() {
  seedN = 7;
  const today = todayStr();
  const state = {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    depts: [{ id: 'd_sales', name: 'Sales showroom & online', sort: 1 }, { id: 'd_mkt', name: 'Sàn TMĐT & Marketing', sort: 2 }, { id: 'd_tech', name: 'Kỹ thuật lắp đặt & bảo hành', sort: 3 }, { id: 'd_dealer', name: 'Kinh doanh đại lý', sort: 4 }, { id: 'd_ops', name: 'Kho, giao vận & kế toán', sort: 5 }],
    people: PEOPLE.map((p) => ({ ...p, active: true })),
    routines: ROUTINES.map((r) => ({ ...r })),
    kpis: makeKpis(),
    tasks: [],
    daystarts: [],
    reports: [],
    weekly: [],
    leaves: [
      { id: uid(), person_id: 'u_ha', from: addDays(-9), to: addDays(-8), type: 'full', note: 'Nghỉ phép việc gia đình' },
      { id: uid(), person_id: 'u_kiet', from: addDays(5), to: addDays(5), type: 'am', note: 'Khám sức khỏe' },
      { id: uid(), person_id: null, from: addDays(-40), to: addDays(-39), type: 'holiday', note: 'Nghỉ lễ Quốc khánh 2/9' },
    ],
    habits: [
      { id: 'h_run', owner_id: 'u_admin', title: 'Chạy bộ', icon: '🏃', days: [1, 3, 5], unit: 'km', target: 5 },
      { id: 'h_water', owner_id: 'u_admin', title: 'Uống đủ 2 lít nước', icon: '💧', days: [0, 1, 2, 3, 4, 5, 6] },
      { id: 'h_sleep', owner_id: 'u_admin', title: 'Ngủ trước 23h', icon: '😴', days: [0, 1, 2, 3, 4, 5, 6] },
    ],
    habit_logs: [],
    chat: [],
  };
  const staffLike = state.people.filter((p) => p.role !== 'bod');
  const from = addDays(-75);
  for (const d of eachDay(from, today)) {
    const isToday = d === today;
    for (const p of staffLike) {
      if (!isWorkday(state, p.id, d)) continue;
      const pr = PROFILE[p.id];
      // Bắt đầu ngày làm việc
      if (!isToday || (p.id !== 'u_kiet' && p.id !== 'u_admin')) {
        let m = between(...pr.start);
        if (pr.late && rnd() < pr.late * 0.4) m += between(15, 50);
        if (isToday) m = Math.min(m, p.id === 'u_bao' ? 812 : 511);
        state.daystarts.push({ id: uid(), person_id: p.id, date: d, started_at: iso(d, m) });
      }
      const inst = instantiateRoutines(state, p, d);
      for (const t of inst) {
        if (isToday) {
          if (t.time && t.time < '10:30' && p.id !== 'u_kiet' && p.id !== 'u_admin') {
            t.status = 'done';
            t.done_at = iso(d, Math.max(560, Number(t.time.slice(0, 2)) * 60 + 20));
            if (t.kpi_id) t.qty = between(1, 3);
            t.output = t.kpi_id ? `${t.qty} ${t.title.includes('video') ? 'video' : 'bài'}` : '';
          }
        } else if (rnd() < pr.done) {
          t.status = 'done';
          t.done_at = iso(d, between(560, 1050));
          if (t.kpi_id) t.qty = between(1, 3);
        }
        state.tasks.push(t);
      }
      // Việc phát sinh
      if (!isToday && rnd() < 0.5) {
        const pool = ADHOC[p.dept || 'admin'];
        const recent = d >= addDays(-3);
        const done = !recent || rnd() < 0.7; // việc cũ coi như đã xử lý xong (có thể trễ hạn)
        const due = addDays(between(0, 3), d);
        state.tasks.push({
          id: uid(), owner_id: p.id, title: pool[between(0, pool.length - 1)], date: d, due_date: due, source: 'adhoc',
          scope: 'work', priority: rnd() < 0.3 ? 'high' : 'mid', status: done ? 'done' : 'todo', progress: 0,
          done_at: done ? iso(rnd() < 0.8 ? d : addDays(between(0, 2), due) > today ? today : addDays(between(0, 2), due), between(600, 1040)) : null, created_at: iso(d, 600),
        });
      }
      // Báo cáo ngày
      if (p.role === 'staff' && !isToday && weekday(d) !== 6 && rnd() < 0.93) {
        const m = rnd() < 0.85 ? between(960, 1019) : between(1021, 1080);
        state.reports.push({
          id: uid(), person_id: p.id, date: d, submitted_at: iso(d, m), blockers: '', plan: '',
          status: d < addDays(-1) || rnd() < 0.5 ? 'approved' : 'submitted', reviewed_at: iso(d, 1060), manager_note: '',
        });
      }
    }
  }

  // Một vài việc "thật" cho hôm nay
  const T = (o) => state.tasks.push({ id: uid(), scope: 'work', priority: 'mid', status: 'todo', progress: 0, created_at: new Date().toISOString(), ...o });
  T({ owner_id: 'u_mai', title: 'Chốt đơn combo BBS8 Pro cho khách Thanh Oai', date: addDays(-2), due_date: addDays(1), source: 'assigned', assigned_by: 'u_admin', priority: 'high', status: 'doing', progress: 60, note: 'Khách đã đồng ý giá, chờ chọn ngày lắp' });
  T({ owner_id: 'u_mai', title: 'Gửi báo giá phòng karaoke kinh doanh 3 phòng', date: addDays(-2), due_date: addDays(-1), source: 'adhoc', priority: 'high' });
  T({ owner_id: 'u_kiet', title: 'Lắp đặt combo iCON-9 tại Cầu Giấy', date: addDays(-1), due_date: today, source: 'assigned', assigned_by: 'u_admin', priority: 'high', status: 'blocked', block_reason: 'Kho chưa xuất sub S200', need_help: 'Nhờ kho xuất hàng trước 10h' });
  T({ owner_id: 'u_bao', title: 'Đăng sản phẩm BBS iCON mới lên TikTok Shop', date: today, due_date: today, source: 'adhoc', priority: 'high', status: 'doing', progress: 50 });
  T({ owner_id: 'u_ha', title: 'Soạn hợp đồng đại lý cho cửa hàng Nam Định', date: addDays(-1), due_date: addDays(3), source: 'plan', priority: 'mid' });
  T({ owner_id: 'u_admin', title: 'Gặp nhà cung cấp BBS về lô hàng tháng sau', date: today, time: '14:00', due_date: today, source: 'adhoc', priority: 'high' });
  T({ owner_id: 'u_admin', title: 'Duyệt chính sách chiết khấu đại lý Q4', date: addDays(-2), due_date: addDays(1), source: 'adhoc', status: 'doing', progress: 40 });
  T({ owner_id: 'u_admin', title: 'Đóng tiền internet nhà', date: addDays(-1), due_date: addDays(2), source: 'adhoc', scope: 'private', group: 'family', priority: 'high' });
  T({ owner_id: 'u_admin', title: 'Thanh toán thẻ tín dụng', date: today, due_date: addDays(4), source: 'adhoc', scope: 'private', group: 'finance' });
  T({ owner_id: 'u_admin', title: 'Đặt lịch khám răng', date: today, source: 'adhoc', scope: 'private', group: 'health', priority: 'low' });

  // Nhật ký thói quen
  for (const d of eachDay(addDays(-80), addDays(-1))) {
    for (const h of state.habits) {
      if (!h.days.includes(weekday(d))) continue;
      if (rnd() < (h.id === 'h_run' ? 0.7 : 0.8)) state.habit_logs.push({ id: uid(), habit_id: h.id, date: d, value: h.unit ? between(3, 7) : 1 });
    }
  }

  // Báo cáo tuần trước
  const lastWeek = addDays(-7, weekStart());
  for (const p of state.people.filter((x) => x.role === 'staff')) {
    state.weekly.push({ id: uid(), person_id: p.id, week: lastWeek, highlights: 'Hoàn thành KPI chính của tuần', issues: '', next_plan: 'Duy trì tần suất, tập trung khách mới', submitted_at: iso(addDays(4, lastWeek), 860), status: 'approved' });
  }

  state.chat = [
    { role: 'bot', text: 'Chào bạn 👋 Mình là trợ lý VietK. Bạn có thể nhắn kiểu:\n• "Mai 3h chiều gọi lại khách Thanh Oai chốt lịch lắp, quan trọng"\n• "Hôm nay còn gì?"\n• "Team hôm nay thế nào?"\n• "Sáng nay chạy 5km"', at: new Date().toISOString() },
  ];
  return state;
}

// Dự án mẫu cho chế độ demo
