import { beforeEach, describe, expect, it } from 'vitest';
import {
  cvBuilderDraftKey,
  readCvBuilderDraft,
  removeCvBuilderDraft,
  writeCvBuilderDraft,
} from './cvBuilderDraftStorage';

describe('cvBuilderDraftStorage', () => {
  beforeEach(() => localStorage.clear());

  it('lưu, đọc và xóa nháp riêng theo tài khoản và CV', () => {
    const key = cvBuilderDraftKey('candidate-1', 'cv-1');
    writeCvBuilderDraft(key, {
      title: 'CV Backend', isPrimary: false, selectedTemplateId: null,
      accentColor: '#2563eb', fontFamily: 'INTER', layout: 'ats', density: 'normal',
      showAvatar: false,
      sectionVisibility: {
        summary: true, experiences: true, projects: true, educations: true,
        activities: true, skills: true, languages: true, certificates: true,
      },
      content: {
        fullName: 'Nguyễn Văn A', experiences: [], projects: [], educations: [],
        activities: [], skills: [], languages: [], certificates: [],
      },
    });

    expect(readCvBuilderDraft(key)?.title).toBe('CV Backend');
    removeCvBuilderDraft(key);
    expect(readCvBuilderDraft(key)).toBeNull();
  });
});
