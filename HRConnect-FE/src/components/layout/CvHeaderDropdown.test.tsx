import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { CvHeaderDropdown } from './CvHeaderDropdown';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CvHeaderDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button with "Tạo CV"', () => {
    render(
      <MemoryRouter>
        <CvHeaderDropdown />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Tạo CV/i });
    expect(trigger).toBeInTheDocument();
  });

  it('shows dropdown items when trigger button is clicked', () => {
    render(
      <MemoryRouter>
        <CvHeaderDropdown />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Tạo CV/i });
    fireEvent.click(trigger);

    expect(screen.getByText('Mẫu CV theo style')).toBeInTheDocument();
    expect(screen.getByText('Mẫu CV Đơn giản')).toBeInTheDocument();
    expect(screen.getByText('Mẫu CV Ấn tượng')).toBeInTheDocument();
    expect(screen.getByText('Mẫu CV Chuyên nghiệp')).toBeInTheDocument();
    expect(screen.getByText('Mẫu CV Harvard')).toBeInTheDocument();

    expect(screen.getByText('Mẫu CV theo vị trí ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên kinh doanh')).toBeInTheDocument();
    expect(screen.getByText('Lập trình viên')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên kế toán')).toBeInTheDocument();
    expect(screen.getByText('Chuyên viên marketing')).toBeInTheDocument();

    expect(screen.getByText('Quản lý CV')).toBeInTheDocument();
    expect(screen.getByText('Tải CV lên')).toBeInTheDocument();
    expect(screen.getByText('Hướng dẫn viết CV')).toBeInTheDocument();
    expect(screen.getByText('Quản lý Cover Letter')).toBeInTheDocument();
    expect(screen.getByText('Mẫu Cover Letter')).toBeInTheDocument();
  });

  it('navigates to style specific cv builder when style is clicked', () => {
    render(
      <MemoryRouter>
        <CvHeaderDropdown />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Tạo CV/i });
    fireEvent.click(trigger);

    const simpleItem = screen.getByText('Mẫu CV Đơn giản');
    fireEvent.click(simpleItem);

    expect(mockNavigate).toHaveBeenCalledWith('/candidate/cv-builder?style=simple');
  });

  it('navigates to role specific cv builder when role is clicked', () => {
    render(
      <MemoryRouter>
        <CvHeaderDropdown />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Tạo CV/i });
    fireEvent.click(trigger);

    const devItem = screen.getByText('Lập trình viên');
    fireEvent.click(devItem);

    expect(mockNavigate).toHaveBeenCalledWith('/candidate/cv-builder?role=developer');
  });

  it('navigates to cv storage when Quản lý CV is clicked', () => {
    render(
      <MemoryRouter>
        <CvHeaderDropdown />
      </MemoryRouter>
    );

    const trigger = screen.getByRole('button', { name: /Tạo CV/i });
    fireEvent.click(trigger);

    const manageItem = screen.getByText('Quản lý CV');
    fireEvent.click(manageItem);

    expect(mockNavigate).toHaveBeenCalledWith('/candidate/cvs');
  });
});

