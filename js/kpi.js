// KPI: danh sách theo người, đèn tín hiệu theo tiến độ, thêm/sửa KPI (quản lý).
import { html, Modal, Avatar, Bar, Section, Empty, ConfirmButton } from './ui.js';
import { useState } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
import { actions } from './store.js';
import * as U from './util.js';

export function KpiList({ ctx, ownerId, at: ref = U.todayStr(), onEdit }) {
  const kpis = ctx.state.kpis.filter((k) => k.owner_id === ownerId && k.active);
  if (!kpis.length) return html`<${Empty}>Chưa có KPI.</${Empty}>`;
  return html`<div class="kpilist">${kpis.map((k) => html`<${KpiRow} key=${k.id} ctx=${ctx} k=${k} at=${ref} onEdit=${onEdit} />`)}</div>`;
}

function KpiRow({ ctx, k, at: ref, onEdit }) {
  const prog = U.kpiProgress(ctx.state, k, ref);
  const pace = U.kpiPace(prog, ref);
  const isAdmin = ctx.me.role === 'admin';
  return html`<div class="kpirow">
    <div class="row between">
      <div><b>${k.title}</b> <span class="muted small">· ${U.KPI_TYPES[k.type].icon} mục tiêu ${k.type === 'bool' ? 'hoàn thành' : k.target + (k.type === 'percent' ? '%' : ' ' + k.unit)}/${U.KPI_PERIODS[k.period]}</span></div>
      <span class=${'pace ' + pace.cls}>${pace.icon} ${pace.label}</span>
    </div>
    <div class="kpibar">
      <${Bar} pct=${prog.pct} cls=${pace.cls} label=${`${prog.value}/${prog.target}`} />
      <b>${k.type === 'bool' ? (prog.value ? 'Xong' : 'Chưa') : `${prog.value}/${prog.target}`}</b>
      <span class="muted small">${prog.pct}%</span>
    </div>
    <div class="row small muted">
      <span>${U.fmtShort(prog.from)} – ${U.fmtShort(prog.to)}</span>
      ${k.type === 'bool' && isAdmin && html`<button class="link" onClick=${() => actions.setKpiManual(k.id, prog.from, !prog.value)}>${prog.value ? 'Đánh dấu chưa xong' : 'Đánh dấu đã xong'}</button>`}
      ${k.type === 'percent' && isAdmin && html`<span class="row">Cập nhật: <input class="mini-in" type="number" min="0" max="100" value=${prog.value} onChange=${(e) => actions.setKpiManual(k.id, prog.from, Number(e.target.value) || 0)} />%</span>`}
      ${k.type === 'count' && html`<span>· tự cộng từ checklist</span>`}
      ${onEdit && html`<button class="link push" onClick=${() => onEdit(k)}>Sửa</button>`}
    </div>
  </div>`;
}

export function KpiView({ ctx }) {
  const { state, me } = ctx;
  const isAdmin = me.role === 'admin';
  const [edit, setEdit] = useState(null);
  const [ref, setRef] = useState(U.todayStr());
  if (me.role === 'staff')
    return html`<div class="page narrow">
      <div class="page-head"><h1>🎯 KPI của tôi</h1></div>
      <p class="note">KPI do quản lý đặt. Số liệu <b>tự cộng</b> mỗi khi bạn tick xong việc có gắn KPI và nhập số lượng.</p>
      <${KpiList} ctx=${ctx} ownerId=${me.id} />
    </div>`;
  const staff = U.visibleWorkers(state, me);
  return html`<div class="page">
    <div class="page-head">
      <h1>🎯 KPI team</h1>
      <div class="row">
        <button class="btn" onClick=${() => setRef(U.addDays(-7, ref))}>‹ Tuần trước</button>
        <span class="muted">${U.periodLabel('week', ref)}</span>
        <button class="btn" disabled=${ref >= U.todayStr()} onClick=${() => setRef(U.addDays(7, ref))}>›</button>
        ${isAdmin && html`<button class="btn primary" onClick=${() => setEdit({})}>+ Thêm KPI</button>`}
      </div>
    </div>
    ${isAdmin && html`<details class="howto"><summary>KPI hoạt động thế nào?</summary>
      <ul>
        <li><b>🔢 Số lượng</b>: gắn KPI vào routine (VD "Đăng bài Facebook"). Khi nhân viên tick xong và nhập số lượng → KPI tự cộng.</li>
        <li><b>✅ Có / Không</b>: mục tiêu dạng cột mốc (VD "Hoàn thành landing page"). Bạn đánh dấu khi xong.</li>
        <li><b>📊 Phần trăm</b>: chỉ số tự nhập (VD tỉ lệ chốt deal).</li>
        <li>Đèn 🟢🟡🔴 so tiến độ với thời gian đã trôi qua của chu kỳ — biết chậm ngay giữa tuần.</li>
      </ul></details>`}
    ${Object.entries({ ...U.DEPTS, _none: 'Chưa xếp nhóm' }).filter(([dk]) => staff.some((p) => (dk === '_none' ? !U.DEPTS[p.dept] : p.dept === dk))).map(([dk, dl]) => html`<${Section} title=${dl} key=${dk}>
      <div class="pgrid wide">${staff.filter((p) => (dk === '_none' ? !U.DEPTS[p.dept] : p.dept === dk)).map((p) => html`<div class="card pad">
        <div class="row"><${Avatar} p=${p} /><b>${p.full_name}</b></div>
        <${KpiList} ctx=${ctx} ownerId=${p.id} at=${ref} onEdit=${isAdmin && setEdit} />
      </div>`)}</div>
    </${Section}>`)}
    ${edit && html`<${KpiForm} ctx=${ctx} k=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function KpiForm({ ctx, k, onClose }) {
  const { state } = ctx;
  const staff = U.visibleWorkers(state, ctx.me);
  const [f, setF] = useState({ title: '', owner_id: staff[0]?.id, type: 'count', target: 5, period: 'week', unit: '', applyAll: false, routine_ids: [], ...k });
  const set = (key) => (e) => setF({ ...f, [key]: e.target ? e.target.value : e });
  const owner = state.people.find((p) => p.id === f.owner_id);
  const routines = state.routines.filter((r) => r.kind !== 'meeting' && (r.owner_id === f.owner_id || r.dept === owner?.dept));
  // KPI gợi ý theo vị trí (khớp tên nhóm). Mã KPI trùng với routine gợi ý để tự cộng từ checklist.
  const TEMPLATES = kpiTemplates(U.deptName(owner?.dept), owner?.role);
  function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    const targets = f.applyAll && !k.id ? staff.filter((p) => p.dept === owner.dept) : [owner];
    const key = k.key || f.key || f.title.trim().toLowerCase().replace(/\s+/g, '_');
    for (const p of targets) actions.saveKpi({ id: k.id, key, title: f.title.trim(), owner_id: p.id, type: f.type, target: Number(f.target) || 1, period: f.period, unit: f.unit }, f.routine_ids);
    ctx.notify(k.id ? 'Đã lưu KPI' : `Đã thêm KPI cho ${targets.length} người`);
    onClose();
  }
  return html`<${Modal} title=${k.id ? 'Sửa KPI' : 'Thêm KPI'} onClose=${onClose}>
    <form class="form" onSubmit=${save}>
      <label>Giao cho<select value=${f.owner_id} disabled=${!!k.id} onChange=${set('owner_id')}>${staff.map((p) => html`<option value=${p.id}>${p.full_name} — ${U.deptName(p.dept)}</option>`)}</select></label>
      ${!k.id && html`<label class="check"><input type="checkbox" checked=${f.applyAll} onChange=${(e) => setF({ ...f, applyAll: e.target.checked })} /> Áp dụng cho cả nhóm ${U.deptName(owner?.dept)}</label>`}
      ${!k.id && html`<div><span class="muted small">Mẫu nhanh:</span><div class="chips">${TEMPLATES.map(([t, n, u, ky, pd, tp]) => html`<button type="button" class="chip" onClick=${() => setF({ ...f, title: t, target: n, unit: u, type: tp || 'count', period: pd || 'week', key: ky })}>${t}</button>`)}</div></div>`}
      <label>Tên KPI *<input value=${f.title} onInput=${set('title')} placeholder="VD: Bài đăng Facebook" /></label>
      <div class="chips">${Object.entries(U.KPI_TYPES).map(([key, t]) => html`<button type="button" class=${'chip ' + (f.type === key ? 'on' : '')} onClick=${() => setF({ ...f, type: key })}>${t.icon} ${t.label}</button>`)}</div>
      <div class="grid3">
        ${f.type !== 'bool' && html`<label>Mục tiêu<input type="number" min="1" value=${f.target} onInput=${set('target')} /></label>`}
        ${f.type === 'count' && html`<label>Đơn vị<input value=${f.unit} onInput=${set('unit')} placeholder="bài, video…" /></label>`}
        <label>Chu kỳ<select value=${f.period} onChange=${set('period')}>${Object.entries(U.KPI_PERIODS).map(([key, l]) => html`<option value=${key}>Mỗi ${l}</option>`)}</select></label>
      </div>
      ${f.type === 'count' && routines.length > 0 && html`<div><b class="small">Tự cộng từ routine nào?</b>
        <div class="chips">${routines.map((r) => html`<button type="button" class=${'chip ' + (f.routine_ids.includes(r.id) ? 'on' : '')}
          onClick=${() => setF({ ...f, routine_ids: f.routine_ids.includes(r.id) ? f.routine_ids.filter((x) => x !== r.id) : [...f.routine_ids, r.id] })}>${r.title}</button>`)}</div></div>`}
      <div class="row between">
        ${k.id ? html`<${ConfirmButton} label="Xoá KPI" ask="Bấm lần nữa để xoá" onConfirm=${() => { actions.deleteKpi(k.id); onClose(); }} />` : html`<span></span>`}
        <div class="row"><button type="button" class="btn" onClick=${onClose}>Huỷ</button><button class="btn primary">Lưu</button></div>
      </div>
    </form>
  </${Modal}>`;
}

// [tên, mục tiêu, đơn vị, mã KPI, chu kỳ, loại]
export function kpiTemplates(dept, role) {
  const d = U.fold ? U.fold(dept) : String(dept || '').toLowerCase();
  const T = [];
  if (role === 'manager') T.push(['Tỉ lệ việc nhóm hoàn thành đúng hạn', 90, '%', 'team_ontime', 'month', 'percent'], ['Báo cáo nhóm được duyệt đúng hạn', 95, '%', 'team_reports', 'month', 'percent']);
  if (/showroom|online|sales|ban le|tu van/.test(d))
    T.push(['Khách hỏi mới tiếp nhận (Fanpage/Zalo/hotline/showroom)', 60, 'khách', 'leads'], ['Báo giá đã gửi', 25, 'báo giá', 'quotes_sent'], ['Đơn chốt', 15, 'đơn', 'orders'],
      ['Doanh số chốt (triệu đồng)', 300, 'triệu', 'revenue', 'month'], ['Tỉ lệ chốt / khách hỏi', 25, '%', 'close_rate', 'month', 'percent']);
  else if (/tmdt|san|marketing|shopee|tiktok/.test(d))
    T.push(['Đơn sàn (Shopee/Lazada/TikTok Shop)', 150, 'đơn', 'mkt_orders', 'month'], ['Doanh thu sàn (triệu đồng)', 200, 'triệu', 'mkt_revenue', 'month'],
      ['Bài đăng / video mới', 20, 'bài', 'posts'], ['Buổi livestream', 8, 'buổi', 'lives', 'month'], ['Đánh giá shop ≥', 4.8, 'sao', 'rating', 'month', 'count']);
  else if (/ky thuat|lap dat|bao hanh/.test(d))
    T.push(['Lịch lắp đặt hoàn thành', 25, 'lịch', 'installs', 'month'], ['Lắp đúng hẹn', 95, '%', 'install_ontime', 'month', 'percent'],
      ['Phiếu bảo hành xử lý xong', 15, 'phiếu', 'warranty_done', 'month'], ['Khách phải gọi lại sửa lần 2 ≤', 3, 'lần', 'callbacks', 'month', 'count']);
  else if (/dai ly|npp|phan phoi/.test(d))
    T.push(['Đại lý mới ký', 3, 'đại lý', 'dealers_new', 'month'], ['Đại lý được liên hệ / chăm sóc', 40, 'đại lý', 'dealers_contacted'],
      ['Doanh số đại lý (triệu đồng)', 500, 'triệu', 'dealer_revenue', 'month'], ['Công nợ quá hạn ≤ (triệu đồng)', 50, 'triệu', 'overdue_debt', 'month', 'count']);
  else if (/kho|giao van|ke toan/.test(d))
    T.push(['Phiếu xuất / giao đúng hẹn', 98, '%', 'ship_ontime', 'month', 'percent'], ['Lệch tồn kho khi kiểm kê ≤', 0, 'sản phẩm', 'stock_diff', 'month', 'count'],
      ['Đối chiếu công nợ đại lý', 4, 'lần', 'debt_checks', 'month']);
  if (!T.length) T.push(['Việc hoàn thành đúng hạn', 90, '%', 'ontime', 'month', 'percent'], ['Đầu việc chính hoàn thành', 10, 'việc', 'tasks_done']);
  return T;
}
