import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ActivityBarChart, CashflowAreaChart, RoleBreakdownBar, clampTooltipLeft, compactAmount, shortDay } from './DashboardCharts';
import type { ActivityPoint, CashflowPoint, RoleBreakdownPoint } from '@/types/api/admin';

const days = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];

const cashflow = (overrides: Partial<Record<string, Partial<CashflowPoint>>> = {}): CashflowPoint[] =>
  days.map((date) => ({
    date,
    serviceFeesPaidAmount: 0,
    refundsPaidAmount: 0,
    postingFeesPaidAmount: 0,
    payoutsAmount: 0,
    ...overrides[date],
  }));

const activity = (overrides: Partial<Record<string, Partial<ActivityPoint>>> = {}): ActivityPoint[] =>
  days.map((date) => ({ date, newUsers: 0, auditEvents: 0, approvalsCompleted: 0, ...overrides[date] }));

const tooltipText = () => document.querySelector('[aria-hidden].pointer-events-none')?.textContent ?? '';

const bandOf = (button: HTMLElement) => {
  const left = parseFloat(button.style.left);
  return { left, right: left + parseFloat(button.style.width) };
};

describe('hit areas line up with what is drawn (90 days, fallback width 640)', () => {
  const n = 90;
  const width = 640;
  const plotW = width - 16; // PAD.left + PAD.right

  it('each cash-flow day band contains that day’s point and bands tile the chart', () => {
    const points: CashflowPoint[] = Array.from({ length: n }, (_, i) => ({
      date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      serviceFeesPaidAmount: i,
      refundsPaidAmount: 0,
      postingFeesPaidAmount: 0,
      payoutsAmount: 0,
    }));
    render(<CashflowAreaChart points={points} currencyCode="VND" />);
    const buttons = within(screen.getByRole('group')).getAllByRole('button');

    buttons.forEach((button, i) => {
      const x = 8 + (i * plotW) / (n - 1);
      const band = bandOf(button);
      expect(band.left).toBeLessThanOrEqual(x);
      expect(band.right).toBeGreaterThanOrEqual(x);
    });
    expect(bandOf(buttons[0]).left).toBe(0);
    expect(bandOf(buttons[n - 1]).right).toBeCloseTo(width);
  });

  it('each activity day band contains that day’s bar pair', () => {
    const points: ActivityPoint[] = Array.from({ length: n }, (_, i) => ({
      date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      newUsers: 1,
      auditEvents: i + 1,
      approvalsCompleted: 0,
    }));
    render(<ActivityBarChart points={points} />);
    const buttons = within(screen.getByRole('group')).getAllByRole('button');

    buttons.forEach((button, i) => {
      const center = 8 + (i + 0.5) * (plotW / n);
      const band = bandOf(button);
      expect(band.left).toBeLessThanOrEqual(center);
      expect(band.right).toBeGreaterThanOrEqual(center);
    });
  });
});

describe('helpers', () => {
  it('keeps the tooltip inside the chart box near both edges', () => {
    // 294px chart (360px phone), 214px tooltip.
    expect(clampTooltipLeft(8, 214, 294)).toBe(0);
    expect(clampTooltipLeft(286, 214, 294)).toBe(80);
    expect(clampTooltipLeft(147, 214, 294)).toBe(40);
    for (let x = 0; x <= 294; x += 7) {
      const left = clampTooltipLeft(x, 214, 294);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + 214).toBeLessThanOrEqual(294);
    }
  });

  it('formats axis labels and days', () => {
    expect(shortDay('2026-11-07')).toBe('07/11');
    expect(compactAmount(45_000_000)).toBe('45 tr');
    expect(compactAmount(1_500_000_000)).toBe('1,5 tỷ');
  });
});

describe('CashflowAreaChart', () => {
  const points = cashflow({
    '2026-11-14': { serviceFeesPaidAmount: 30_000_000, postingFeesPaidAmount: 2_500_000, payoutsAmount: 9_000_000, refundsPaidAmount: 4_000_000 },
    '2026-11-16': { serviceFeesPaidAmount: 5_000_000 },
  });

  it('renders one keyboard target per day with a summary that does not count refunds as income', () => {
    render(<CashflowAreaChart points={points} currencyCode="VND" />);

    const group = screen.getByRole('group', { name: /Chi tiết dòng tiền theo ngày/ });
    expect(within(group).getAllByRole('button')).toHaveLength(7);
    // 30,000,000 + 2,500,000 + 5,000,000 = 37,500,000; the 4,000,000 refund is not income.
    expect(screen.getByRole('img', { name: /tổng thu 37\.500\.000 đ, tổng chi hoa hồng 9\.000\.000 đ/ })).toBeInTheDocument();
  });

  it('shows the tooltip on focus with income, payout and the refund on its own line', () => {
    render(<CashflowAreaChart points={points} currencyCode="VND" />);

    const day = screen.getByRole('button', { name: /^14\/11\/2026/ });
    fireEvent.focus(day);

    const text = tooltipText();
    expect(text).toContain('14/11/2026');
    expect(text).toContain('Tổng thu32.500.000 đ');
    expect(text).toContain('Chi hoa hồng9.000.000 đ');
    expect(text).toContain('Hoàn cho Client4.000.000 đ');
    expect(day).toHaveAccessibleName('14/11/2026: thu 32.500.000 đ, chi hoa hồng 9.000.000 đ, hoàn cho Client 4.000.000 đ');
  });

  it('shows the tooltip on hover and hides the refund line when there is none', () => {
    render(<CashflowAreaChart points={points} currencyCode="VND" />);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /^16\/11\/2026/ }));

    const text = tooltipText();
    expect(text).toContain('Tổng thu5.000.000 đ');
    expect(text).not.toContain('Hoàn cho Client');
  });

  it('moves between days with the arrow keys (roving tabindex)', () => {
    render(<CashflowAreaChart points={points} currencyCode="VND" />);

    const buttons = within(screen.getByRole('group')).getAllByRole('button');
    expect(buttons.filter((b) => b.tabIndex === 0)).toEqual([buttons[6]]);

    buttons[6].focus();
    fireEvent.keyDown(buttons[6], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[5]);
    fireEvent.keyDown(buttons[5], { key: 'Home' });
    expect(document.activeElement).toBe(buttons[0]);
    expect(tooltipText()).toContain('11/11/2026');
  });

  it('draws a period with only refunds without a meaningless peak label', () => {
    render(<CashflowAreaChart points={cashflow({ '2026-11-15': { refundsPaidAmount: 5_400_000 } })} currencyCode="VND" />);

    expect(screen.queryByText(/^Đỉnh/)).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button', { name: /^15\/11\/2026/ }));
    expect(tooltipText()).toContain('Tổng thu0 đ');
    expect(tooltipText()).toContain('Hoàn cho Client5.400.000 đ');
  });

  it('shows an empty state instead of empty axes when every value is zero', () => {
    render(<CashflowAreaChart points={cashflow()} currencyCode="VND" />);

    expect(screen.getByText('Chưa có phát sinh trong kỳ')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('ActivityBarChart', () => {
  it('renders a column per day and a tooltip with the day counts on focus', () => {
    render(
      <ActivityBarChart
        points={activity({ '2026-11-15': { auditEvents: 62, newUsers: 4, approvalsCompleted: 2 } })}
      />
    );

    expect(within(screen.getByRole('group')).getAllByRole('button')).toHaveLength(7);
    fireEvent.focus(screen.getByRole('button', { name: /^15\/11\/2026/ }));

    const text = tooltipText();
    expect(text).toContain('Sự kiện audit62');
    expect(text).toContain('Người dùng mới4');
    expect(text).toContain('Hồ sơ đã duyệt2');
  });

  it('handles 90 days without errors', () => {
    const many: ActivityPoint[] = Array.from({ length: 90 }, (_, i) => ({
      date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      newUsers: i % 3,
      auditEvents: i,
      approvalsCompleted: 0,
    }));
    render(<ActivityBarChart points={many} />);

    expect(within(screen.getByRole('group')).getAllByRole('button')).toHaveLength(90);
  });

  it('shows an empty state when nothing happened', () => {
    render(<ActivityBarChart points={activity()} />);

    expect(screen.getByText('Chưa có phát sinh trong kỳ')).toBeInTheDocument();
  });
});

describe('RoleBreakdownBar', () => {
  const items: RoleBreakdownPoint[] = [
    { role: 'CANDIDATE', count: 3 },
    { role: 'AFFILIATE', count: 3 },
    { role: 'CLIENT_COMPANY_USER', count: 6 },
    { role: 'INTERNAL_HR', count: 3 },
    { role: 'PLATFORM_ADMIN', count: 0 },
  ];

  it('labels every role in Vietnamese with counts and shares', () => {
    render(<RoleBreakdownBar items={items} />);

    for (const label of ['Ứng viên', 'Affiliate', 'Doanh nghiệp', 'Internal HR', 'Quản trị viên']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Doanh nghiệp: 6/ })).toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toContain('headhunter');
  });

  it('shows an empty state when no user holds a role', () => {
    render(<RoleBreakdownBar items={items.map((i) => ({ ...i, count: 0 }))} />);

    expect(screen.getByText('Chưa có người dùng theo vai trò')).toBeInTheDocument();
  });
});
