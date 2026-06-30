const API = '/api';

const ИСТОЧНИК_ОРМ = 'ОРМ';
const ИСТОЧНИК_SQL = 'SQL';

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function renderHierarchyOrm(tree, container) {
  container.innerHTML = '';
  const badge = `<span class="badge badge-orm">${ИСТОЧНИК_ОРМ}</span>`;
  function appendNode(node, parentEl, isRoot) {
    const div = document.createElement('div');
    div.className = isRoot ? 'tree-root' : 'tree-node';
    div.innerHTML = `<strong>${escapeHtml(node.name)}</strong> ${badge}
      <span style="color:var(--muted)">[${node.code || '—'}] экземпляров: ${node.itemsCount}</span>`;
    parentEl.appendChild(div);
    (node.children || []).forEach((c) => appendNode(c, div, false));
  }
  tree.forEach((n) => appendNode(n, container, true));
}

function renderHierarchySql(rows, container) {
  container.innerHTML = `<span class="badge badge-sql">${ИСТОЧНИК_SQL} — рекурсивный запрос</span><br/><br/>`;
  rows.forEach((r) => {
    const indent = '&nbsp;'.repeat(r.depth * 4);
    container.innerHTML += `${indent}└ ${escapeHtml(r.name)}
      <span style="color:var(--muted)"> уровень ${r.depth} | ${escapeHtml(r.path)} | экземпляров: ${r.items_count}</span><br/>`;
  });
}

function renderCatalogBooks(data, out) {
  let html = `<span class="badge badge-orm">${ИСТОЧНИК_ОРМ} — книги</span><table>
    <tr><th>№</th><th>Название</th><th>Автор</th><th>Отдел</th><th>ISBN</th><th>Издательство</th></tr>`;
  data.forEach((b) => {
    html += `<tr><td>${b.catalogItemId}</td><td>${esc(b.catalogItem.title)}</td>
      <td>${esc(b.author)}</td><td>${esc(b.catalogItem.department.name)}</td>
      <td>${esc(b.isbn)}</td><td>${esc(b.publisher)}</td></tr>`;
  });
  out.innerHTML = html + '</table>';
}

function renderCatalogPeriodicals(data, out) {
  let html = `<span class="badge badge-orm">${ИСТОЧНИК_ОРМ} — периодика</span><table>
    <tr><th>№</th><th>Название</th><th>Периодичность</th><th>ISSN</th><th>Номер выпуска</th><th>Отдел</th></tr>`;
  data.forEach((p) => {
    html += `<tr><td>${p.catalogItemId}</td><td>${esc(p.catalogItem.title)}</td>
      <td>${esc(p.frequency)}</td><td>${esc(p.issn)}</td><td>${esc(p.issueNumber)}</td>
      <td>${esc(p.catalogItem.department.name)}</td></tr>`;
  });
  out.innerHTML = html + '</table>';
}

function renderCatalogSql(data, out) {
  let html = `<span class="badge badge-sql">${ИСТОЧНИК_SQL} — объединение таблиц (TPT)</span><table>
    <tr><th>Тип</th><th>№</th><th>Название</th><th>Инв. №</th><th>Отдел</th><th>Поле 1</th><th>Поле 2</th></tr>`;
  data.forEach((r) => {
    html += `<tr><td>${esc(r.item_type)}</td><td>${r.id}</td><td>${esc(r.title)}</td>
      <td>${esc(r.inventory_no)}</td><td>${esc(r.department_name)}</td>
      <td>${esc(r.detail1)}</td><td>${esc(r.detail2)}</td></tr>`;
  });
  out.innerHTML = html + '</table>';
}

function renderReadersCurrent(data, source, out) {
  const badge = source === 'orm' ? 'badge-orm' : 'badge-sql';
  const label = source === 'orm' ? ИСТОЧНИК_ОРМ : ИСТОЧНИК_SQL;
  let html = `<span class="badge ${badge}">${label} — актуальные читатели</span><table>
    <tr><th>№</th><th>ФИО</th><th>Версия</th><th>Почта</th><th>Тип абонемента</th><th>Статус</th></tr>`;
  if (source === 'orm') {
    data.forEach((r) => {
      const v = r.current;
      if (!v) return;
      html += row(v.readerId, v.fullName, v.versionNumber, v.email, v.membershipType, v.isCurrent);
    });
  } else {
    data.forEach((v) => {
      html += row(v.reader_id, v.full_name, v.version_number, v.email, v.membership_type, v.is_current);
    });
  }
  out.innerHTML = html + '</table>';
  function row(id, name, ver, email, type, current) {
    const cur = current ? '<span class="badge badge-current">АКТУАЛЬНАЯ</span>' : '—';
    return `<tr><td>${id}</td><td>${esc(name)}</td><td>вер. ${ver}</td><td>${esc(email)}</td><td>${esc(type)}</td><td>${cur}</td></tr>`;
  }
}

function renderVersions(data, source, out) {
  const badge = source === 'orm' ? 'badge-orm' : 'badge-sql';
  const label = source === 'orm' ? ИСТОЧНИК_ОРМ : ИСТОЧНИК_SQL;
  let html = `<span class="badge ${badge}">${label} — история версий</span><table>
    <tr><th>Версия</th><th>Дата создания</th><th>ФИО</th><th>Почта</th><th>Тип абонемента</th><th>Статус</th></tr>`;
  data.forEach((v) => {
    const ver = source === 'orm' ? v.versionNumber : v.version_number;
    const dt = source === 'orm' ? v.validFrom : v.valid_from;
    const name = source === 'orm' ? v.fullName : v.full_name;
    const email = v.email;
    const type = source === 'orm' ? v.membershipType : v.membership_type;
    const cur = source === 'orm' ? v.isCurrent : v.is_current;
    html += `<tr><td>вер. ${ver}</td><td>${new Date(dt).toLocaleString('ru-RU')}</td>
      <td>${esc(name)}</td><td>${esc(email)}</td><td>${esc(type)}</td>
      <td>${cur ? '<span class="badge badge-current">АКТУАЛЬНАЯ</span>' : 'архивная'}</td></tr>`;
  });
  out.innerHTML = html + '</table>';
}

function esc(s) {
  if (s == null) return '—';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escapeHtml = esc;

document.getElementById('load-hierarchy').addEventListener('click', async () => {
  const out = document.getElementById('hierarchy-output');
  const src = document.getElementById('hierarchy-source').value;
  out.textContent = 'Загрузка…';
  try {
    const path = src === 'orm' ? '/departments/tree/orm' : '/departments/tree/sql';
    const json = await fetchJson(API + path);
    if (src === 'orm') renderHierarchyOrm(json.data, out);
    else renderHierarchySql(json.data, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('load-books-orm').addEventListener('click', async () => {
  const out = document.getElementById('catalog-output');
  out.textContent = 'Загрузка…';
  try {
    const json = await fetchJson(API + '/catalog/books/orm');
    renderCatalogBooks(json.data, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('load-periodicals-orm').addEventListener('click', async () => {
  const out = document.getElementById('catalog-output');
  out.textContent = 'Загрузка…';
  try {
    const json = await fetchJson(API + '/catalog/periodicals/orm');
    renderCatalogPeriodicals(json.data, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('load-catalog-sql').addEventListener('click', async () => {
  const out = document.getElementById('catalog-output');
  out.textContent = 'Загрузка…';
  try {
    const json = await fetchJson(API + '/catalog/all/sql');
    renderCatalogSql(json.data, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('load-readers').addEventListener('click', async () => {
  const out = document.getElementById('readers-output');
  const src = document.getElementById('readers-source').value;
  out.textContent = 'Загрузка…';
  try {
    const path = src === 'orm' ? '/readers/current/orm' : '/readers/current/sql';
    const json = await fetchJson(API + path);
    renderReadersCurrent(json.data, src, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('load-history').addEventListener('click', async () => {
  const out = document.getElementById('readers-output');
  const id = document.getElementById('history-reader-id').value;
  const src = document.getElementById('history-source').value;
  if (!id) {
    out.innerHTML = '<span class="error">Укажите номер читателя</span>';
    return;
  }
  out.textContent = 'Загрузка…';
  try {
    const path = `/readers/${id}/versions/${src}`;
    const json = await fetchJson(API + path);
    renderVersions(json.data, src, out);
  } catch (e) {
    out.innerHTML = `<span class="error">Ошибка: ${e.message}</span>`;
  }
});

document.getElementById('reader-update-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = document.getElementById('readers-output');
  const id = document.getElementById('reader-id').value;
  const via = document.getElementById('update-via').value;
  const body = {
    fullName: document.getElementById('reader-name').value,
    email: document.getElementById('reader-email').value || undefined,
    membershipType: document.getElementById('reader-membership').value,
  };
  out.textContent = 'Сохранение…';
  try {
    const json = await fetchJson(API + `/readers/${id}/${via}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const viaLabel = via === 'orm' ? ИСТОЧНИК_ОРМ : ИСТОЧНИК_SQL;
    out.innerHTML = `<span class="badge badge-${via}">Создана новая версия (${viaLabel})</span><pre>${JSON.stringify(json.data, null, 2)}</pre>`;
  } catch (err) {
    out.innerHTML = `<span class="error">Ошибка: ${err.message}</span>`;
  }
});

document.getElementById('load-hierarchy').click();
