import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiScore } from './AiScore';

describe('AiScore', () => {
  it('renders "Chấm lỗi" when status is FAILED and score is null', () => {
    render(<AiScore score={null} status="FAILED" />);
    expect(screen.getByText('Chấm lỗi')).toBeInTheDocument();
  });

  it('renders "Đang chấm…" when status is PENDING or PROCESSING', () => {
    const { rerender } = render(<AiScore score={null} status="PENDING" />);
    expect(screen.getByText('Đang chấm…')).toBeInTheDocument();

    rerender(<AiScore score={null} status="PROCESSING" />);
    expect(screen.getByText('Đang chấm…')).toBeInTheDocument();
  });

  it('renders "Chưa có điểm" when score is null and status is idle or completed', () => {
    render(<AiScore score={null} status={null} />);
    expect(screen.getByText('Chưa có điểm')).toBeInTheDocument();
  });

  it('renders HIGH tier with heart icon for score >= 80 or tier HIGH', () => {
    render(<AiScore score={85} tier="HIGH" />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Rất phù hợp')).toBeInTheDocument();
  });

  it('renders MEDIUM_HIGH tier for score between 70 and 79', () => {
    render(<AiScore score={74} />);
    expect(screen.getByText('74%')).toBeInTheDocument();
    expect(screen.getByText('Khá phù hợp')).toBeInTheDocument();
  });

  it('renders MEDIUM tier for score between 60 and 69', () => {
    render(<AiScore score={62} />);
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('Phù hợp một phần')).toBeInTheDocument();
  });

  it('renders LOW tier for score < 60', () => {
    render(<AiScore score={45} />);
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Ít phù hợp')).toBeInTheDocument();
  });
});

