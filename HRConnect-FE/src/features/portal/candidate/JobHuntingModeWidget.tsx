/**
 * @file JobHuntingModeWidget.tsx
 * @description Widget "Bật Chế Độ Tìm Việc" (Job Hunting Mode Switch) chuẩn TopCV & LinkedIn.
 * Cho phép ứng viên bật/tắt trạng thái tìm việc, chọn nhanh CV chính để NTD xem xét,
 * cho phép NTD tìm kiếm và cam kết ẩn thông tin với công ty hiện tại.
 */
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Lock,
  ChevronDown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Tooltip, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import type { CandidateCv } from '@/types/api/mf02';
import { candidateKeys } from '../CandidatePages';

interface JobHuntingModeWidgetProps {
  cvs?: CandidateCv[];
  initialIsHunting?: boolean;
  className?: string;
}

export const JobHuntingModeWidget: React.FC<JobHuntingModeWidgetProps> = ({
  cvs,
  initialIsHunting = true,
  className = '',
}) => {
  const queryClient = useQueryClient();

  // Query CVs if not provided as prop
  const { data: queriedCvs = [] } = useQuery({
    queryKey: candidateKeys.cvs,
    queryFn: () => candidateCvApi.list(),
    enabled: !cvs || cvs.length === 0,
  });

  const availableCvs = (cvs && cvs.length > 0) ? cvs : queriedCvs;

  // Trạng thái bật/tắt tìm việc
  const [isHunting, setIsHunting] = useState<boolean>(() => {
    const saved = localStorage.getItem('hrconnect_candidate_job_hunting_mode');
    return saved !== null ? saved === 'true' : initialIsHunting;
  });

  // Checkbox cho phép NTD tìm kiếm
  const [allowEmployerSearch, setAllowEmployerSearch] = useState<boolean>(true);

  // CV chính được chọn
  const primaryCv = availableCvs.find((c) => c.isPrimary) || availableCvs[0];
  const [selectedCvId, setSelectedCvId] = useState<string>(primaryCv?.cvId || '');

  useEffect(() => {
    if (primaryCv && !selectedCvId) {
      setSelectedCvId(primaryCv.cvId);
    }
  }, [primaryCv, selectedCvId]);

  // Mutation chuyển CV chính
  const setPrimaryCvMutation = useMutation({
    mutationFn: (cvId: string) => candidateCvApi.setPrimary(cvId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.cvs });
      void message.success('Đã cập nhật CV chính cho các cơ hội nghề nghiệp!');
    },
    onError: () => {
      void message.error('Không thể đổi CV chính. Vui lòng thử lại.');
    },
  });

  const handleToggleHunting = () => {
    const nextState = !isHunting;
    setIsHunting(nextState);
    localStorage.setItem('hrconnect_candidate_job_hunting_mode', String(nextState));

    // Đồng bộ với API visibility nếu có
    try {
      void mf04Api.updateVisibility({ visibility: nextState ? 'PUBLIC' : 'PRIVATE' });
    } catch {
      // Ignored if offline
    }

    if (nextState) {
      void message.success('Đã bật chế độ Tìm việc! Nhà tuyển dụng có thể tiếp cận hồ sơ của bạn.');
    } else {
      void message.info('Đã tạm dừng tìm việc. Hồ sơ của bạn sẽ được ẩn khỏi tìm kiếm.');
    }
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCvId = e.target.value;
    setSelectedCvId(newCvId);
    if (newCvId) {
      setPrimaryCvMutation.mutate(newCvId);
    }
  };

  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ${className}`}
    >
      {/* 1. Bên Trái: Toggle Switch + Trạng Thái Tìm Việc */}
      <div className="flex items-start sm:items-center gap-3.5">
        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isHunting}
          onClick={handleToggleHunting}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
            isHunting ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
          title={isHunting ? 'Bấm để tạm dừng tìm việc' : 'Bấm để bật chế độ tìm việc'}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isHunting ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        {/* Nhãn trạng thái */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 m-0">
              {isHunting ? 'Đang tìm việc làm' : 'Tạm dừng tìm việc'}
            </h3>
            {isHunting ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Bật nhận cơ hội
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Đang ẩn hồ sơ
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            {isHunting
              ? 'Hồ sơ của bạn đang sẵn sàng đón nhận lời mời phỏng vấn từ các nhà tuyển dụng hàng đầu.'
              : 'Nhà tuyển dụng sẽ không tìm kiếm thấy hồ sơ của bạn cho đến khi bạn bật lại.'}
          </p>
        </div>
      </div>

      {/* 2. Ở Giữa: Dropdown CV chính & Checkbox quyền tìm kiếm */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:border-l md:border-slate-200/80 md:pl-4">
        {/* Dropdown chọn nhanh CV chính */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 shrink-0 whitespace-nowrap flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            CV chính:
          </span>
          <div className="relative min-w-[200px] max-w-[280px]">
            <select
              value={selectedCvId}
              onChange={handleCvChange}
              disabled={!isHunting || availableCvs.length === 0}
              className="w-full bg-[#f2f3ff] border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed truncate"
              title="Chọn CV chính gửi đến nhà tuyển dụng"
            >
              {availableCvs.length === 0 ? (
                <option value="">Chưa có CV trong kho</option>
              ) : (
                availableCvs.map((cv) => (
                  <option key={cv.cvId} value={cv.cvId}>
                    {cv.title || cv.fileName} {cv.isPrimary ? '(Mặc định)' : ''}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Checkbox cho phép NTD gửi lời mời */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-medium">
          <input
            type="checkbox"
            checked={allowEmployerSearch && isHunting}
            disabled={!isHunting}
            onChange={(e) => setAllowEmployerSearch(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
          />
          <span>Cho phép NTD tìm kiếm & gửi lời mời</span>
        </label>
      </div>

      {/* 3. Bên Phải: Huy hiệu an toàn & Cam kết bảo mật */}
      <div className="shrink-0">
        <Tooltip
          title="HR Connect ứng dụng công nghệ bảo mật thông minh: Tự động ẩn toàn bộ thông tin liên lạc và dữ liệu ứng tuyển của bạn trước các nhà tuyển dụng thuộc công ty bạn đang làm việc."
          placement="topRight"
        >
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl font-medium cursor-help hover:bg-slate-100 transition-colors">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Cam kết bảo mật — Ẩn với công ty hiện tại</span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default JobHuntingModeWidget;
