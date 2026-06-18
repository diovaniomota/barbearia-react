import { expect, test } from '@playwright/test';

const SUPER_EMAIL = 'diovaniomotaa@gmail.com';
const SUPER_PASS = '123456';
const BARBER_EMAIL = 'lukasgabrielribeiro07@gmail.com';
const BARBER_PASS = '123456';

async function loginAs(page, email, password) {
  await page.goto('/admin');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
}

async function navTo(page, label) {
  await page.locator('.nav-item', { hasText: label }).click();
  await page.waitForTimeout(1000);
}

async function openDrawerItem(page, label) {
  await page.locator('.nav-item', { hasText: 'Menu' }).click();
  await page.waitForTimeout(600);
  await page.locator('.drawer-button', { hasText: label }).click();
  await page.waitForTimeout(1500);
}

// ── Login ────────────────────────────────────────────────────────────────────

test('login — campos com ícones, checkbox, botão Entrar', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(page.locator('input[type=password]')).toBeVisible();
  // login-field: ícone + input em linha (flex row)
  const emailField = page.locator('.login-field').first();
  await expect(emailField).toBeVisible();
  await expect(emailField.locator('svg')).toBeVisible();
  await expect(page.locator('text=Lembrar e-mail')).toBeVisible();
  await expect(page.locator('text=Esqueci minha senha')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

// ── Dashboard super-admin ────────────────────────────────────────────────────

test('dashboard super-admin — cards, ranking, pizza', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);

  // Cards lado a lado no grid
  const grid = page.locator('.dashboard-grid');
  await expect(grid).toBeVisible();
  const cards = grid.locator('.metric-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByText('Realizados hoje')).toBeVisible();
  await expect(cards.nth(1).getByText('Realizados no mês')).toBeVisible();

  // Ranking
  await expect(page.locator('text=Top barbeiros do mês')).toBeVisible();
  await expect(page.locator('.rank-bar-row').first()).toBeVisible();

  // Pizza
  await expect(page.locator('text=Resumo em pizza')).toBeVisible();
  await expect(page.locator('.pie')).toBeVisible();
  await expect(page.locator('.pie-legend')).toBeVisible();
});

// ── Dashboard barber-admin ───────────────────────────────────────────────────

test('dashboard barber-admin — cards, meu mês, reativar', async ({ page }) => {
  await loginAs(page, BARBER_EMAIL, BARBER_PASS);

  const grid = page.locator('.dashboard-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('.metric-card')).toHaveCount(2);

  await expect(page.locator('.my-month')).toBeVisible();
  await expect(page.locator('text=Clientes para reativar')).toBeVisible();

  // Nav de barber-admin não tem WhatsApp
  await expect(page.locator('.nav-item', { hasText: 'WhatsApp' })).toHaveCount(0);
});

// ── Caixa ────────────────────────────────────────────────────────────────────

test('caixa — filtros em linha, lista barbeiros, mensalidades, total', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await navTo(page, 'Caixa');

  // Filtro Dia + data em linha
  await expect(page.locator('.finance-filter-top')).toBeVisible();
  await expect(page.locator('.finance-period')).toBeVisible();
  await expect(page.locator('.finance-date-btn')).toBeVisible();

  // Select barbeiro full-width
  await expect(page.locator('.finance-barber-select')).toBeVisible();
  await expect(page.locator('.finance-barber-select option').first()).toHaveText('Todos os barbeiros');

  // Conteúdo carregado
  await expect(page.locator('.finance-body')).toBeVisible();
  await expect(page.locator('.finance-mensalidades')).toBeVisible();
  await expect(page.locator('text=Mensalidades')).toBeVisible();
  await expect(page.locator('.finance-total-card')).toBeVisible();
  await expect(page.locator('.finance-grand-total')).toBeVisible();
  await expect(page.locator('text=Total')).toBeVisible();
  await expect(page.locator('text=Avulsos')).toBeVisible();
  await expect(page.getByText('Plano', { exact: true })).toBeVisible();
});

// ── Agenda ───────────────────────────────────────────────────────────────────

test('agendamentos — título, filtros iguais ao caixa, mensagem sem barbeiro', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await navTo(page, 'Agenda');

  // Título correto
  await expect(page.locator('h1').filter({ hasText: 'Agendamentos' })).toBeVisible();

  // Filtros idênticos ao Caixa
  await expect(page.locator('.finance-filter-top')).toBeVisible();
  await expect(page.locator('.agenda-period-label')).toBeVisible();
  await expect(page.locator('.finance-date-btn')).toBeVisible();
  await expect(page.locator('.finance-barber-select')).toBeVisible();

  // Sem barbeiro selecionado → mensagem
  await expect(page.locator('.agenda-no-barber')).toBeVisible();
  await expect(page.locator('text=Selecione um barbeiro acima para ver a agenda do dia.')).toBeVisible();
});

test('agendamentos — legenda compacta e subtítulo ao selecionar barbeiro', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await navTo(page, 'Agenda');

  // Selecionar primeiro barbeiro
  const sel = page.locator('.finance-barber-select');
  const options = await sel.locator('option').all();
  if (options.length > 1) {
    await sel.selectOption({ index: 1 });
    await page.waitForTimeout(2000);

    // Legenda compacta com pontinhos
    await expect(page.locator('.agenda-legend-compact')).toBeVisible();
    await expect(page.locator('.slot-dot.free')).toBeVisible();
    await expect(page.locator('.slot-dot.blocked')).toBeVisible();

    // Subtítulo em dourado
    await expect(page.locator('.agenda-subtitle')).toBeVisible();
  }
});

test('agendamentos barber-admin — auto-seleciona próprio barbeiro', async ({ page }) => {
  await loginAs(page, BARBER_EMAIL, BARBER_PASS);
  await navTo(page, 'Agenda');

  // Barber-admin não vê o select de barbeiro
  await expect(page.locator('.finance-barber-select')).toHaveCount(0);

  // Já mostra a agenda (legenda deve aparecer)
  await page.waitForTimeout(2000);
  await expect(page.locator('.agenda-legend-compact')).toBeVisible();
});

// ── WhatsApp ─────────────────────────────────────────────────────────────────

test('whatsapp — card status, mensagens automáticas, botões empilhados', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await navTo(page, 'WhatsApp');

  // Card de status com ícone verde
  await expect(page.locator('.wa-status-card')).toBeVisible();
  await expect(page.locator('.wa-status-icon-wrap')).toBeVisible();
  await expect(page.locator('text=Mensagens automáticas')).toBeVisible();

  // Seção servidor
  await expect(page.locator('text=Servidor WhatsApp')).toBeVisible();
  await expect(page.locator('.wa-server-hint')).toBeVisible();

  // Botão Conectar full-width (outline-btn sem compact)
  const connectBtn = page.locator('.outline-btn', { hasText: 'Conectar' });
  await expect(connectBtn).toBeVisible();
  const btnBox = await connectBtn.boundingBox();
  expect(btnBox.width).toBeGreaterThan(300); // full width

  // Link reset (não botão side-by-side)
  await expect(page.locator('.wa-reset-link')).toBeVisible();
  await expect(page.locator('text=Resetar sessão (novo QR)')).toBeVisible();

  // Template editor
  await expect(page.locator('text=Mensagem automática')).toBeVisible();
});

// ── Serviços ──────────────────────────────────────────────────────────────────

test('serviços — botão deletar na mesma linha dos outros', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await openDrawerItem(page, 'Serviços');

  await expect(page.locator('h1').filter({ hasText: 'Serviços' })).toBeVisible();

  const rows = page.locator('.service-admin-row');
  await expect(rows.first()).toBeVisible();

  // Em cada linha deve haver toggle, edit e delete no mesmo article
  const firstRow = rows.first();
  await expect(firstRow.locator('.switch')).toBeVisible();
  await expect(firstRow.locator('button[aria-label="Editar"]')).toBeVisible();
  await expect(firstRow.locator('button[aria-label="Excluir"]')).toBeVisible();

  // Delete não deve estar em segunda linha (mesmo bounding box Y que o toggle)
  const toggleBox = await firstRow.locator('.switch').boundingBox();
  const deleteBox = await firstRow.locator('button[aria-label="Excluir"]').boundingBox();
  const yDiff = Math.abs(deleteBox.y - toggleBox.y);
  expect(yDiff).toBeLessThan(30); // mesma linha ±30px
});

// ── Barbeiros ─────────────────────────────────────────────────────────────────

test('barbeiros — botão deletar na mesma linha', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await openDrawerItem(page, 'Barbeiros');

  await expect(page.locator('h1').filter({ hasText: 'Barbeiros' })).toBeVisible();

  const firstRow = page.locator('.list-card').first();
  await expect(firstRow.locator('.switch')).toBeVisible();
  await expect(firstRow.locator('button[aria-label="Editar"]')).toBeVisible();
  await expect(firstRow.locator('button[aria-label="Excluir"]')).toBeVisible();

  const toggleBox = await firstRow.locator('.switch').boundingBox();
  const deleteBox = await firstRow.locator('button[aria-label="Excluir"]').boundingBox();
  const yDiff = Math.abs(deleteBox.y - toggleBox.y);
  expect(yDiff).toBeLessThan(30);
});

// ── Clientes Plano ────────────────────────────────────────────────────────────

test('clientes plano — botão deletar na mesma linha', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await openDrawerItem(page, 'Clientes Plano');

  await expect(page.locator('h1').filter({ hasText: 'Clientes Plano' })).toBeVisible();

  const rows = page.locator('.list-card');
  const count = await rows.count();
  if (count > 0) {
    const firstRow = rows.first();
    await expect(firstRow.locator('button[aria-label="Recorrentes"]')).toBeVisible();
    await expect(firstRow.locator('button[aria-label="Editar"]')).toBeVisible();
    await expect(firstRow.locator('button[aria-label="Remover"]')).toBeVisible();

    const editBox = await firstRow.locator('button[aria-label="Editar"]').boundingBox();
    const removeBox = await firstRow.locator('button[aria-label="Remover"]').boundingBox();
    const yDiff = Math.abs(editBox.y - removeBox.y);
    expect(yDiff).toBeLessThan(30);
  }
});

// ── Remarcar ──────────────────────────────────────────────────────────────────

test('remarcar — título correto e empty state ou lista de inativos', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);
  await openDrawerItem(page, 'Remarcar');

  await expect(page.locator('h1').filter({ hasText: 'Remarcar Clientes' })).toBeVisible();

  const hasEmpty = await page.locator('.remarcar-empty').isVisible();
  if (hasEmpty) {
    await expect(page.locator('text=Todos os clientes visitaram')).toBeVisible();
    await expect(page.locator('text=nos últimos 30 dias!')).toBeVisible();
    await expect(page.locator('text=Nenhum cliente inativo encontrado.')).toBeVisible();
  } else {
    // Tem clientes inativos — verifica estrutura
    await expect(page.locator('.list-card').first()).toBeVisible();
    await expect(page.locator('.list-card a[aria-label="WhatsApp"]').first()).toBeVisible();
  }
});

// ── Menu drawer ───────────────────────────────────────────────────────────────

test('menu drawer — seções PRINCIPAL e GERENCIAR, botão Remarcar', async ({ page }) => {
  await loginAs(page, SUPER_EMAIL, SUPER_PASS);

  await page.locator('.nav-item', { hasText: 'Menu' }).click();
  await page.waitForTimeout(600);

  // Seção PRINCIPAL
  await expect(page.locator('.drawer-section', { hasText: /principal/i })).toBeVisible();

  // Seção GERENCIAR
  await expect(page.locator('.drawer-section', { hasText: /gerenciar/i })).toBeVisible();

  // Tem "Remarcar", não "Clientes"
  await expect(page.locator('.drawer-button', { hasText: 'Remarcar' })).toBeVisible();
  await expect(page.locator('.drawer-button', { hasText: 'Clientes' }).filter({ hasNotText: 'Plano' })).toHaveCount(0);

  // Sair
  await expect(page.locator('.drawer-button', { hasText: 'Sair' })).toBeVisible();
});

// ── Barber-admin sem WhatsApp no menu ────────────────────────────────────────

test('barber-admin — sem WhatsApp no drawer', async ({ page }) => {
  await loginAs(page, BARBER_EMAIL, BARBER_PASS);

  await page.locator('.nav-item', { hasText: 'Menu' }).click();
  await page.waitForTimeout(600);

  await expect(page.locator('.drawer-button', { hasText: 'WhatsApp' })).toHaveCount(0);
  await expect(page.locator('.drawer-button', { hasText: 'Serviços' })).toHaveCount(0);
  await expect(page.locator('.drawer-button', { hasText: 'Barbeiros' })).toHaveCount(0);
});
