/**
 * @file AiScoringSettingsCard.tsx
 * @description Grouped card for MF-03 AI scoring weights and knockout cap on /admin/settings.
 * Enforces that the 4 weights sum to 100% before allowing a batch save.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, InputNumber } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { businessSettingsApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { BusinessSetting } from '@/types/api/finance';

export const AI_SCORING_KEYS = {
  mustHave: 'mf03.ai_scoring.must_have_weight',
  shouldHave: 'mf03.ai_scoring.should_have_weight',
  semantic: 'mf03.ai_scoring.semantic_weight',
  llmFit: 'mf03.ai_scoring.llm_fit_weight',
  knockoutCap: 'mf03.ai_scoring.knockout_cap_score',
} as const;

const WEIGHT_FIELDS: { key: string; label: string }[] = [
  { key: AI_SCORING_KEYS.mustHave, label: 'Trọng số tiêu chí bắt buộc MUST_HAVE (%)' },
  { key: AI_SCORING_KEYS.shouldHave, label: 'Trọng số tiêu chí ưu tiên SHOULD_HAVE (%)' },
  { key: AI_SCORING_KEYS.semantic, label: 'Trọng số tương đồng ngữ nghĩa Semantic (%)' },
  { key: AI_SCORING_KEYS.llmFit, label: 'Trọng số mức phù hợp tổng thể LLM Fit (%)' },
];

const KNOCKOUT_LABEL = 'Trần điểm Knockout khi thiếu tiêu chí bắt buộc (điểm)';

interface AiScoringSettingsCardProps {
  items: BusinessSetting[];
}

export const AiScoringSettingsCard: React.FC<AiScoringSettingsCardProps> = ({ items }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const initialValues = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      map[item.key] = item.value;
    });
    return map;
  }, [items]);

  const [drafts, setDrafts] = useState<Record<string, number | null>>(initialValues);

  useEffect(() => {
    setDrafts(initialValues);
  }, [initialValues]);

  const weightSum = WEIGHT_FIELDS.reduce((sum, f) => sum + (drafts[f.key] ?? 0), 0);
  const roundedWeightSum = Math.round(weightSum * 1000) / 1000;
  const hasInvalidNumber = [...WEIGHT_FIELDS.map((f) => f.key), AI_SCORING_KEYS.knockoutCap].some(
    (k) => drafts[k] === null || drafts[k] === undefined || Number.isNaN(drafts[k])
  );
  const weightSumValid = Math.abs(roundedWeightSum - 100) <= 0.001;
  const hasChanges = Object.keys(initialValues).some((k) => drafts[k] !== initialValues[k]);

  const saveBatch = useMutation({
    mutationFn: (payload: { key: string; value: number }[]) => businessSettingsApi.updateBatch(payload),
    onSuccess: () => {
      message.success('Đã lưu cấu hình chấm điểm AI (MF-03).');
      void queryClient.invalidateQueries({ queryKey: ['admin-business-settings'] });
    },
    onError: (err) => message.error(getApiErrorMessage(err, 'Không thể lưu cấu hình chấm điểm AI.')),
  });

  const handleSave = () => {
    if (hasInvalidNumber || !weightSumValid) return;
    const payload = [...WEIGHT_FIELDS.map((f) => f.key), AI_SCORING_KEYS.knockoutCap].map((key) => ({
      key,
      value: Number(drafts[key]),
    }));
    saveBatch.mutate(payload);
  };

  const handleResetDefaults = () => {
    const next: Record<string, number> = {};
    items.forEach((item) => {
      next[item.key] = item.defaultValue;
    });
    setDrafts(next);
  };

  const knockoutItem = items.find((i) => i.key === AI_SCORING_KEYS.knockoutCap);
  const isAtDefault = items.every((item) => drafts[item.key] === item.defaultValue);

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5 sm:grid-cols-2">
        {WEIGHT_FIELDS.map((field) => {
          const item = items.find((i) => i.key === field.key);
          return (
            <div
              key={field.key}
              className="rounded-xl border border-solid border-black/[0.08] bg-white p-4 space-y-2"
            >
              <label htmlFor={`ai-setting-${field.key}`} className="block text-sm font-semibold text-[#111827]">
                {field.label}
              </label>
              <InputNumber
                id={`ai-setting-${field.key}`}
                aria-label={field.label}
                className="w-full font-semibold"
                min={item?.min ?? 0}
                max={item?.max ?? 100}
                step={1}
                value={drafts[field.key] ?? null}
                onChange={(v) => setDrafts((prev) => ({ ...prev, [field.key]: typeof v === 'number' ? v : null }))}
                addonAfter="%"
              />
              {item && (
                <div className="text-xs text-slate-500">
                  Mặc định: {item.defaultValue}% · Khoảng: {item.min}–{item.max}%
                </div>
              )}
            </div>
          );
        })}
      </div>

      {knockoutItem && (
        <div className="rounded-xl border border-solid border-black/[0.08] bg-white p-4 space-y-2">
          <label htmlFor={`ai-setting-${AI_SCORING_KEYS.knockoutCap}`} className="block text-sm font-semibold text-[#111827]">
            {KNOCKOUT_LABEL}
          </label>
          <InputNumber
            id={`ai-setting-${AI_SCORING_KEYS.knockoutCap}`}
            aria-label={KNOCKOUT_LABEL}
            className="w-full sm:max-w-xs font-semibold"
            min={knockoutItem.min}
            max={knockoutItem.max}
            step={1}
            value={drafts[AI_SCORING_KEYS.knockoutCap] ?? null}
            onChange={(v) =>
              setDrafts((prev) => ({ ...prev, [AI_SCORING_KEYS.knockoutCap]: typeof v === 'number' ? v : null }))
            }
            addonAfter="điểm"
          />
          <div className="text-xs text-slate-500">
            Mặc định: {knockoutItem.defaultValue} điểm · Áp dụng làm trần điểm tối đa khi hồ sơ thiếu ít nhất 1 tiêu chí MUST_HAVE.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-solid border-slate-200 bg-white px-4 py-3">
        <div className="text-sm text-slate-700">
          Tổng 4 trọng số hiện tại:{' '}
          <strong className={weightSumValid ? 'text-emerald-700 tabular-nums' : 'text-red-600 tabular-nums'}>
            {roundedWeightSum}%
          </strong>{' '}
          <span className="text-xs text-slate-500">(yêu cầu: 100%)</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            icon={<ReloadOutlined />}
            disabled={isAtDefault || saveBatch.isPending}
            onClick={handleResetDefaults}
          >
            Khôi phục mặc định
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveBatch.isPending}
            disabled={!weightSumValid || hasInvalidNumber || !hasChanges}
            onClick={handleSave}
          >
            Lưu cấu hình AI
          </Button>
        </div>
      </div>

      {!weightSumValid && (
        <Alert
          type="error"
          showIcon
          message={`Tổng 4 trọng số hiện tại là ${roundedWeightSum}%. Vui lòng điều chỉnh để tổng đúng bằng 100% trước khi lưu.`}
        />
      )}
    </div>
  );
};
