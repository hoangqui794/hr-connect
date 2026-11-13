import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CvCanvas } from './CvCanvas';
import type { StructuredCvContent } from '@/types/api/cvBuilder';
import type { SectionVisibility } from './CvSidebarTools';

const mockContent: StructuredCvContent = {
  fullName: 'Nguyễn Lê Nghi',
  headline: 'Backend Developer',
  email: 'nghi@example.com',
  phone: '0901234567',
  address: 'Hồ Chí Minh',
  summary: 'Lập trình viên Backend nhiệt huyết với .NET và React.',
  experiences: [
    {
      title: 'Backend Developer',
      company: 'Công ty ABC Tech',
      startDate: '03/2023',
      endDate: 'nay',
      description: '• Thiết kế REST API bằng ASP.NET Core 8.\n• Tối ưu truy vấn SQL Server.',
    },
  ],
  educations: [
    {
      degree: 'Kỹ sư Phần mềm',
      school: 'Đại học FPT',
      startDate: '2019',
      endDate: '2023',
      description: 'GPA 3.4/4',
    },
  ],
  projects: [
    {
      name: 'HR Connect Platform',
      role: 'Backend Dev',
      startDate: '2024',
      endDate: 'nay',
      technologies: '.NET 8, React',
      description: 'Hệ thống tuyển dụng nhân sự',
    },
  ],
  skills: ['C#', '.NET Core', 'React', 'SQL Server'],
  languages: ['Tiếng Anh', 'Tiếng Nhật'],
  certificates: ['AWS Certified Developer'],
};

const defaultVisibility: SectionVisibility = {
  summary: true,
  experiences: true,
  educations: true,
  skills: true,
  languages: true,
  projects: true,
  certificates: true,
  activities: true,
};

describe('CvCanvas Component', () => {
  it('allows space key typing in input fields without prevention', () => {
    const handleChangeContent = vi.fn();
    render(
      <CvCanvas
        content={mockContent}
        onChangeContent={handleChangeContent}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="ats"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const nameInput = screen.getByDisplayValue('Nguyễn Lê Nghi');
    // Simulate typing a space
    fireEvent.keyDown(nameInput, { key: ' ', code: 'Space' });
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Lê Nghi ' } });

    expect(handleChangeContent).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Nguyễn Lê Nghi ' })
    );
  });

  it('allows editing education years/period inline and calls onChangeContent with parsed dates', () => {
    const handleChangeContent = vi.fn();
    render(
      <CvCanvas
        content={mockContent}
        onChangeContent={handleChangeContent}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="ats"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    // Look for the education period input "2019 – 2023"
    const periodInput = screen.getByDisplayValue('2019 – 2023');
    expect(periodInput).toBeInTheDocument();

    // Change year to "2020 – 2024"
    fireEvent.change(periodInput, { target: { value: '2020 – 2024' } });

    expect(handleChangeContent).toHaveBeenCalledWith({
      educations: [
        expect.objectContaining({
          school: 'Đại học FPT',
          startDate: '2020',
          endDate: '2024',
        }),
      ],
    });
  });

  it('renders ATS layout correctly with standard single-column structure', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="ats"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--ats');
    expect(paper).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nguyễn Lê Nghi')).toBeInTheDocument();
  });

  it('renders modern 2-column layout with left sidebar and right main column', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="modern"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--modern');
    expect(paper).toBeInTheDocument();

    // Verify 2-column grid exists
    const grid = container.querySelector('.grid.grid-cols-1');
    expect(grid).toBeInTheDocument();

    // Left column contains skills, right contains experience/education
    expect(screen.getByDisplayValue('C#, .NET Core, React, SQL Server')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đại học FPT')).toBeInTheDocument();
  });

  it('renders executive layout with reverse 2-column structure', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="executive"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--executive');
    expect(paper).toBeInTheDocument();
  });

  it('renders elegant layout with colored header banner', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="elegant"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--elegant');
    expect(paper).toBeInTheDocument();

    // Header has background color style
    const header = container.querySelector('header.cv-paper__header');
    expect(header).toBeInTheDocument();
    expect(header?.getAttribute('style')).toContain('background-color: rgb(2, 132, 199)');
  });

  it('renders compact layout with vertical timeline styling', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="compact"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--compact');
    expect(paper).toBeInTheDocument();

    // Timeline items exist
    const timelineItems = container.querySelectorAll('.cv-timeline-item');
    expect(timelineItems.length).toBeGreaterThan(0);
  });

  it('renders minimal layout with subtle styling', () => {
    const { container } = render(
      <CvCanvas
        content={mockContent}
        onChangeContent={vi.fn()}
        accentColor="#0284C7"
        fontFamily="BE_VIETNAM_PRO"
        layout="minimal"
        density="normal"
        sectionVisibility={defaultVisibility}
      />
    );

    const paper = container.querySelector('.cv-paper--minimal');
    expect(paper).toBeInTheDocument();
  });
});
