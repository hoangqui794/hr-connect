namespace HRConnect.Presentation.Endpoints.V1.SubmissionConsents;

internal static class SubmissionConsentPage
{
    internal const string Html = """
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Xác nhận hồ sơ ứng tuyển | HR Connect</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #f4f7f5; color: #17351f; }
    main { width: min(680px, calc(100% - 32px)); margin: 48px auto; }
    .card { background: white; border: 1px solid #dce7df; border-radius: 16px; padding: 28px; box-shadow: 0 12px 32px #17351f12; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    .muted { color: #607066; margin: 0 0 24px; }
    .details { display: grid; grid-template-columns: 150px 1fr; gap: 12px; margin: 20px 0; }
    .details dt { color: #607066; }
    .details dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
    label { display: block; margin: 14px 0 6px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; padding: 11px 12px; border: 1px solid #b9c9bd; border-radius: 9px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    button, .button { border: 0; border-radius: 9px; padding: 11px 18px; font-weight: 700; cursor: pointer; text-decoration: none; }
    .primary { background: #236b3a; color: white; }
    .danger { background: #a83232; color: white; }
    .secondary { background: #e7eee9; color: #17351f; }
    button:disabled { opacity: .55; cursor: wait; }
    #message { margin-top: 18px; padding: 12px; border-radius: 9px; background: #eef4ef; white-space: pre-wrap; }
    #message.error { color: #8b2424; background: #fff0f0; }
    [hidden] { display: none !important; }
    @media (max-width: 520px) { .details { grid-template-columns: 1fr; gap: 4px; } main { margin: 20px auto; } .card { padding: 20px; } }
  </style>
</head>
<body>
<main>
  <section class="card">
    <h1>Xác nhận hồ sơ ứng tuyển</h1>
    <p class="muted">Kiểm tra thông tin trước khi cho phép HR Connect gửi hồ sơ đến doanh nghiệp và chuyển CV sang MF03 chấm điểm.</p>

    <form id="loginBox" hidden>
      <p>Hồ sơ này đã liên kết với một tài khoản Candidate. Vui lòng đăng nhập để tiếp tục.</p>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required>
      <label for="password">Mật khẩu</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <div class="actions"><button id="login" class="primary" type="submit">Đăng nhập và tiếp tục</button></div>
    </form>

    <dl id="details" class="details" hidden>
      <dt>Candidate</dt><dd id="candidateName"></dd>
      <dt>Công việc</dt><dd id="jobTitle"></dd>
      <dt>Doanh nghiệp</dt><dd id="companyName"></dd>
      <dt>Tệp CV</dt><dd id="cvFileName"></dd>
      <dt>Hạn xác nhận</dt><dd id="expiresAt"></dd>
    </dl>

    <div id="actions" class="actions" hidden>
      <a id="viewCv" class="button secondary" target="_blank" rel="noopener noreferrer">Xem CV</a>
      <button id="confirm" class="primary" type="button">Đồng ý nộp hồ sơ</button>
      <button id="decline" class="danger" type="button">Từ chối</button>
    </div>
    <div id="message">Đang tải yêu cầu xác nhận…</div>
  </section>
</main>
<script>
(() => {
  'use strict';
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const message = document.getElementById('message');
  const loginBox = document.getElementById('loginBox');
  const details = document.getElementById('details');
  const actions = document.getElementById('actions');
  let accessToken = '';

  function headers() {
    return { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) };
  }
  function show(text, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
  }
  async function json(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || body.title || `HTTP ${response.status}`), { status: response.status });
    return body;
  }
  async function review() {
    if (!token) { show('Liên kết thiếu token xác nhận.', true); return; }
    show('Đang tải yêu cầu xác nhận…');
    details.hidden = true; actions.hidden = true;
    try {
      const body = await json(await fetch('/api/v1/submission-consents/review', {
        method: 'POST', headers: headers(), body: JSON.stringify({ token })
      }));
      const data = body.data;
      document.getElementById('candidateName').textContent = data.candidateName;
      document.getElementById('jobTitle').textContent = data.jobTitle;
      document.getElementById('companyName').textContent = data.companyName;
      document.getElementById('cvFileName').textContent = data.cvFileName;
      document.getElementById('expiresAt').textContent = new Date(data.expiresAt).toLocaleString('vi-VN');
      const viewCv = document.getElementById('viewCv');
      viewCv.href = data.cvDownloadUrl || '#';
      viewCv.hidden = !data.cvDownloadUrl;
      loginBox.hidden = true; details.hidden = false; actions.hidden = false;
      show('Vui lòng xem CV và chọn quyết định.');
    } catch (error) {
      if (error.status === 403) {
        loginBox.hidden = false;
        show('Vui lòng đăng nhập đúng tài khoản Candidate để xem và xác nhận hồ sơ.', true);
      } else {
        show(error.message, true);
      }
    }
  }
  async function login(event) {
    event.preventDefault();
    const button = document.getElementById('login');
    button.disabled = true;
    show('Đang đăng nhập…');
    try {
      const body = await json(await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
          password: document.getElementById('password').value
        })
      }));
      accessToken = body.data.accessToken;
      document.getElementById('password').value = '';
      await review();
    } catch (error) {
      show(error.message, true);
    } finally {
      button.disabled = false;
    }
  }
  async function respond(decision) {
    document.querySelectorAll('button').forEach(button => button.disabled = true);
    show('Đang ghi nhận quyết định…');
    try {
      const body = await json(await fetch('/api/v1/submission-consents/respond', {
        method: 'POST', headers: headers(), body: JSON.stringify({ token, decision })
      }));
      actions.hidden = true;
      show(`${body.message}\nTrạng thái hồ sơ: ${body.submissionStatus}`);
    } catch (error) {
      show(error.message, true);
      document.querySelectorAll('button').forEach(button => button.disabled = false);
      if (error.status === 401 || error.status === 403) loginBox.hidden = false;
    }
  }

  loginBox.addEventListener('submit', login);
  document.getElementById('confirm').addEventListener('click', () => respond('CONFIRM'));
  document.getElementById('decline').addEventListener('click', () => respond('DECLINE'));
  review();
})();
</script>
</body>
</html>
""";
}
