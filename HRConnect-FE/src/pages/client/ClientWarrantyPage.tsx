/**
 * @file ClientWarrantyPage.tsx
 * @path src/pages/client/ClientWarrantyPage.tsx
 * @description Enterprise 60-Day Probation & Warranty Tracker for Client / Company (Role: CLIENT / COMPANY).
 * 
 * Spec A-04 Compliance (Mục 6 - Probation):
 * 1. Strictly displays HIRED & STARTED candidates under HEADHUNT_COD (Tuyển dụng trọn gói - Bảo hành 60 ngày).
 * 2. Antd Table Columns:
 *    - Ứng viên: Họ tên, Vị trí tuyển dụng, Ngày bắt đầu đi làm (Start Date).
 *    - Gói dịch vụ: Tag [Tuyển dụng trọn gói (COD) - Bảo hành 60 ngày].
 *    - Thời hạn bảo hành: Antd <Progress> countdown bar (ví dụ: "Đã thử việc 35/60 ngày").
 *    - Trạng thái thử việc: Tag [Đang thử việc] / [Đã đạt thử việc - PASS] / [Nghỉ việc sớm - FAIL].
 *    - Thao tác:
 *      * Nút [Xác nhận Đạt (PASS)]: Gọi clientService.confirmProbationResult(id, 'PASS').
 *      * Nút [Báo Nghỉ việc / Kích hoạt Bảo hành]: Gọi clientService.confirmProbationResult(id, 'FAIL', note).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, Tag, Progress, Button, Card, Row, Col, Typography, Space,
  Avatar, Modal, Form, DatePicker, Select, Input, Alert, message, Popconfirm,
  Spin,
} from 'antd';
import {
  SafetyCertificateOutlined, CheckCircleOutlined, AlertOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/authStore';
import clientService from '@/services/clientService';
import type { ProbationWarrantyDTO, WarrantyStatus } from '@/types/client';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const ClientWarrantyPage: React.FC = () => {
  const [records, setRecords] = useState<ProbationWarrantyDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State for Early Resignation & Replacement Trigger
  const [isFailModalOpen, setIsFailModalOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<ProbationWarrantyDTO | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [failForm] = Form.useForm();

  const { user } = useAuthStore();
  const isDemoClient = user?.id === 'client-001' || user?.company?.includes('TechCorp');
  const companyId = isDemoClient ? 'client-001' : user?.id;

  // Load data from ClientService & hrconnect_warranty_records
  const loadWarrantyData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getWarrantyList(companyId);

      // Read warranty records from localStorage 'hrconnect_warranty_records'
      let storedWarranties: any[] = [];
      try {
        const raw = localStorage.getItem('hrconnect_warranty_records');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            storedWarranties = parsed;
          }
        }
      } catch {
        // noop
      }

      // Map stored warranties to ProbationWarrantyDTO
      const convertedWarranties: ProbationWarrantyDTO[] = storedWarranties.map((w: any) => ({
        id: w.id,
        applicationId: w.applicationId || `APP-${w.id}`,
        candidateName: w.candidateName,
        candidateEmail: w.candidateEmail,
        jobTitle: w.jobTitle,
        companyName: w.companyName,
        clientEmail: w.clientEmail,
        clientId: w.clientId,
        serviceType: 'HEADHUNT_COD',
        startDate: w.startDate || new Date().toISOString().slice(0, 10),
        probationDaysTotal: (w.maxDays || 60) as 60,
        passedDays: w.daysWorked !== undefined ? w.daysWorked : (w.status === 'PASSED' ? 60 : 0),
        status: w.status === 'PASSED' ? 'PASSED' : w.status === 'FAILED' ? 'FAILED_WARRANTY_TRIGGERED' : 'IN_PROBATION',
        warrantyEndDate: w.warrantyEndDate || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        note: w.notes || (w.status === 'PASSED' ? 'Nghiệm thu thử việc thành công (PASS).' : 'Đang trong chu kỳ bảo hành 60 ngày thử việc'),
        clientDecision: w.clientDecision || (w.status === 'PASSED' ? 'PASSED' : w.status === 'FAILED' ? 'FAILED' : undefined),
        clientFeedbackDate: w.clientFeedbackDate,
      }));

      const currentUser = user;
      const combined = [...data];
      convertedWarranties.forEach((cw) => {
        if (!combined.some((item) => item.id === cw.id || (item.candidateName === cw.candidateName && item.jobTitle === cw.jobTitle))) {
          combined.push(cw);
        }
      });

      // Filter: item.clientEmail === currentUser.email || item.clientId === currentUser.id || item.companyName === currentUser.companyName
      const filteredByClient = combined.filter((item: any) => {
        if (!currentUser) return true;
        const currentCompanyName = currentUser.companyName || (currentUser as any).company || (isDemoClient ? 'TechCorp Việt Nam' : '');
        const matchCondition =
          (item.clientEmail && currentUser.email && item.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
          (item.clientId && currentUser.id && item.clientId === currentUser.id) ||
          (item.companyName && item.companyName === currentCompanyName);

        if (isDemoClient && (!item.clientEmail && !item.clientId)) return true;
        return matchCondition;
      });

      setRecords(filteredByClient);
    } catch (error) {
      message.error('Không thể tải danh sách bảo hành thử việc');
    } finally {
      setLoading(false);
    }
  }, [companyId, user, isDemoClient]);

  useEffect(() => {
    loadWarrantyData();
  }, [loadWarrantyData]);

  // Action: Confirm PASS
  const handleConfirmPass = async (recordId: string) => {
    try {
      setActionLoading(true);
      await clientService.confirmProbationResult(recordId, 'PASS');

      const record = records.find((r) => r.id === recordId);
      const candidateName = record?.candidateName || '';
      const candidateEmail = record?.candidateEmail || '';
      const jobTitle = record?.jobTitle || '';

      // 1. Cập nhật record bảo hành trong hrconnect_warranty_records: daysWorked: 60, status: 'PASSED', clientDecision: 'PASSED'
      try {
        const raw = localStorage.getItem('hrconnect_warranty_records');
        let wList: any[] = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) wList = parsed;
        }

        let foundW = false;
        wList = wList.map((w: any) => {
          const matchId = w.id === recordId || (record?.applicationId && w.applicationId === record.applicationId);
          const matchName = candidateName && w.candidateName && w.candidateName.toLowerCase() === candidateName.toLowerCase();
          const matchJob = jobTitle && w.jobTitle && w.jobTitle.toLowerCase() === jobTitle.toLowerCase();
          if (matchId || (matchName && matchJob) || matchName) {
            foundW = true;
            return {
              ...w,
              daysWorked: 60,
              status: 'PASSED',
              clientDecision: 'PASSED',
              clientFeedbackDate: new Date().toISOString(),
              notes: 'Doanh nghiệp đã xác nhận PASS (60 ngày thử việc)',
              updatedAt: new Date().toISOString(),
            };
          }
          return w;
        });

        if (!foundW) {
          wList.push({
            id: recordId,
            applicationId: record?.applicationId || `APP-${recordId}`,
            candidateName,
            candidateEmail,
            companyName: record?.companyName || user?.companyName || 'Công ty đối tác',
            jobTitle,
            daysWorked: 60,
            maxDays: 60,
            status: 'PASSED',
            clientDecision: 'PASSED',
            clientFeedbackDate: new Date().toISOString(),
            notes: 'Doanh nghiệp đã xác nhận PASS (60 ngày thử việc)',
            updatedAt: new Date().toISOString(),
          });
        }
        localStorage.setItem('hrconnect_warranty_records', JSON.stringify(wList));
      } catch (e) {
        console.error('Lỗi cập nhật hrconnect_warranty_records:', e);
      }

      // 2. Tìm bản ghi hoa hồng tương ứng trong hrconnect_commissions và cập nhật đồng bộ:
      // probationDays: 60 (hoặc progress: 100), status: 'PAYABLE', statusLabel: 'Sẵn sàng nhận Payout'
      try {
        const comRaw = localStorage.getItem('hrconnect_commissions');
        let comList: any[] = [];
        if (comRaw) {
          const parsed = JSON.parse(comRaw);
          if (Array.isArray(parsed)) comList = parsed;
        }

        let foundCom = false;
        comList = comList.map((c: any) => {
          const matchId = c.id === recordId || c.applicationId === recordId || (record?.applicationId && c.applicationId === record.applicationId);
          const matchName = candidateName && c.candidateName && c.candidateName.toLowerCase() === candidateName.toLowerCase();
          const matchEmail = candidateEmail && c.candidateEmail && c.candidateEmail.toLowerCase() === candidateEmail.toLowerCase();
          const matchJob = jobTitle && c.jobTitle && c.jobTitle.toLowerCase() === jobTitle.toLowerCase();
          if (matchId || matchName || matchEmail || matchJob) {
            foundCom = true;
            return {
              ...c,
              probationDays: 60,
              probationDaysPassed: 60,
              progress: 100,
              status: 'PAYABLE',
              statusLabel: 'Sẵn sàng nhận Payout',
              updatedAt: new Date().toISOString(),
            };
          }
          return c;
        });

        if (!foundCom && candidateName) {
          comList.unshift({
            id: 'COM-' + Date.now(),
            candidateName,
            candidateEmail,
            jobTitle,
            companyName: record?.companyName || user?.companyName || '',
            affiliateName: 'Cộng tác viên HRConnect',
            amount: 25000000,
            commissionRate: 15,
            probationDays: 60,
            probationDaysPassed: 60,
            progress: 100,
            status: 'PAYABLE',
            statusLabel: 'Sẵn sàng nhận Payout',
            createdAt: new Date().toISOString(),
          });
        }
        localStorage.setItem('hrconnect_commissions', JSON.stringify(comList));
      } catch (e) {
        console.error('Lỗi cập nhật hrconnect_commissions:', e);
      }

      // Đồng bộ thêm vào hrconnect_warranties nếu có
      try {
        const wRaw = localStorage.getItem('hrconnect_warranties');
        if (wRaw) {
          const wList = JSON.parse(wRaw);
          if (Array.isArray(wList)) {
            const updated = wList.map((w: any) => {
              if (w.id === recordId || (candidateName && w.candidateName && w.candidateName.toLowerCase() === candidateName.toLowerCase())) {
                return {
                  ...w,
                  status: 'PASSED_PROBATION',
                  daysPassed: 60,
                  clientDecision: 'PASSED',
                  clientFeedbackDate: new Date().toISOString(),
                };
              }
              return w;
            });
            localStorage.setItem('hrconnect_warranties', JSON.stringify(updated));
          }
        }
      } catch (e) {
        console.error(e);
      }

      message.success('Đã xác nhận ứng viên VƯỢT QUA thử việc (PASS)! Chu kỳ bảo hành kết thúc thành công.');
      await loadWarrantyData();
    } catch (error) {
      message.error('Xử lý thất bại, vui lòng thử lại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Fail / Warranty Trigger Modal
  const openFailModal = (record: ProbationWarrantyDTO) => {
    setSelectedRecord(record);
    failForm.setFieldsValue({
      candidateName: record.candidateName,
      jobTitle: record.jobTitle,
      resignationDate: dayjs(),
      reason: 'CANDIDATE_RESIGNED',
      notes: '',
    });
    setIsFailModalOpen(true);
  };

  // Submit Fail / Warranty Replacement
  const handleFailSubmit = async () => {
    try {
      const values = await failForm.validateFields();
      if (!selectedRecord) return;

      setActionLoading(true);
      const fullNote = `Nghỉ việc ngày: ${values.resignationDate.format('DD/MM/YYYY')}. Lý do: ${values.reason}. Ghi chú: ${values.notes || 'Không'}`;
      await clientService.confirmProbationResult(selectedRecord.id, 'FAIL', fullNote);

      // Ghi nhận trường clientDecision: 'FAILED' và clientFeedbackDate vào hrconnect_warranty_records
      try {
        const raw = localStorage.getItem('hrconnect_warranty_records');
        let wList: any[] = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) wList = parsed;
        }

        let found = false;
        const candidateName = selectedRecord.candidateName;
        const jobTitle = selectedRecord.jobTitle;

        wList = wList.map((w: any) => {
          const matchId = w.id === selectedRecord.id || (selectedRecord.applicationId && w.applicationId === selectedRecord.applicationId);
          const matchName = candidateName && w.candidateName && w.candidateName.toLowerCase() === candidateName.toLowerCase();
          const matchJob = jobTitle && w.jobTitle && w.jobTitle.toLowerCase() === jobTitle.toLowerCase();
          if (matchId || (matchName && matchJob) || matchName) {
            found = true;
            return {
              ...w,
              status: 'FAILED',
              clientDecision: 'FAILED',
              clientFeedbackDate: new Date().toISOString(),
              notes: fullNote,
              updatedAt: new Date().toISOString(),
            };
          }
          return w;
        });

        if (!found) {
          wList.push({
            id: selectedRecord.id,
            applicationId: selectedRecord.applicationId,
            candidateName: selectedRecord.candidateName,
            candidateEmail: selectedRecord.candidateEmail,
            companyName: selectedRecord.companyName,
            jobTitle: selectedRecord.jobTitle,
            status: 'FAILED',
            clientDecision: 'FAILED',
            clientFeedbackDate: new Date().toISOString(),
            notes: fullNote,
            updatedAt: new Date().toISOString(),
          });
        }
        localStorage.setItem('hrconnect_warranty_records', JSON.stringify(wList));
      } catch (e) {
        console.error('Lỗi cập nhật hrconnect_warranty_records khi Fail:', e);
      }

      // Đồng bộ thêm vào hrconnect_warranties nếu có
      try {
        const wRaw = localStorage.getItem('hrconnect_warranties');
        if (wRaw) {
          const wList = JSON.parse(wRaw);
          if (Array.isArray(wList)) {
            const updated = wList.map((w: any) => {
              if (w.id === selectedRecord.id || (selectedRecord.candidateName && w.candidateName && w.candidateName.toLowerCase() === selectedRecord.candidateName.toLowerCase())) {
                return {
                  ...w,
                  status: 'FAILED_PROBATION',
                  clientDecision: 'FAILED',
                  clientFeedbackDate: new Date().toISOString(),
                };
              }
              return w;
            });
            localStorage.setItem('hrconnect_warranties', JSON.stringify(updated));
          }
        }
      } catch (e) {
        console.error(e);
      }

      message.warning(
        `Đã kích hoạt bảo hành tìm ứng viên thay thế miễn phí cho vị trí "${selectedRecord.jobTitle}". Yêu cầu đã chuyển đến Headhunter phụ trách!`
      );
      setIsFailModalOpen(false);
      await loadWarrantyData();
    } catch {
      // Form validation failure or error
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered List
  const filteredRecords = useMemo(() => {
    if (filterStatus === 'ALL') return records;
    return records.filter((r) => r.status === filterStatus);
  }, [records, filterStatus]);

  // Status Tag Renderer
  const renderStatusTag = (status: WarrantyStatus) => {
    switch (status) {
      case 'IN_PROBATION':
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            Đang thử việc
          </Tag>
        );
      case 'PASSED':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Đã đạt thử việc (PASS)
          </Tag>
        );
      case 'FAILED_WARRANTY_TRIGGERED':
        return (
          <Tag color="error" icon={<AlertOutlined />}>
            Nghỉ việc sớm (Kích hoạt BH)
          </Tag>
        );
    }
  };

  // Columns definition
  const columns: ColumnsType<ProbationWarrantyDTO> = [
    {
      title: 'Ứng viên & Vị trí tuyển dụng',
      key: 'candidate',
      minWidth: 260,
      render: (_: any, record: ProbationWarrantyDTO) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={42} style={{ border: '2px solid #e2e8f0' }}>
            {record.candidateName.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{record.candidateName}</div>
            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{record.jobTitle}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Bắt đầu làm: <strong>{dayjs(record.startDate).format('DD/MM/YYYY')}</strong>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Gói dịch vụ',
      key: 'package',
      minWidth: 230,
      render: () => (
        <Tag color="purple" icon={<SafetyCertificateOutlined />} style={{ padding: '4px 8px', fontSize: 12 }}>
          Tuyển dụng trọn gói (COD) - Bảo hành 60 ngày
        </Tag>
      ),
    },
    {
      title: 'Thời hạn bảo hành (Đếm ngược 60 ngày)',
      key: 'progress',
      minWidth: 260,
      render: (_: any, record: ProbationWarrantyDTO) => {
        const percent = Math.min(100, Math.round((record.passedDays / record.probationDaysTotal) * 100));
        const isCompleted = record.status === 'PASSED';
        const isFailed = record.status === 'FAILED_WARRANTY_TRIGGERED';

        return (
          <div style={{ width: '100%', maxWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: isFailed ? '#dc2626' : isCompleted ? '#16a34a' : '#0284c7' }}>
                {isFailed
                  ? 'Đã dừng bảo hành'
                  : `Đã thử việc ${record.passedDays}/${record.probationDaysTotal} ngày`}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>Hạn: {dayjs(record.warrantyEndDate).format('DD/MM')}</span>
            </div>
            <Progress
              percent={percent}
              size="small"
              strokeColor={isFailed ? '#ef4444' : isCompleted ? '#16a34a' : '#2563eb'}
              status={isFailed ? 'exception' : isCompleted ? 'success' : 'active'}
              format={() => `${percent}%`}
            />
          </div>
        );
      },
    },
    {
      title: 'Trạng thái thử việc',
      dataIndex: 'status',
      key: 'status',
      minWidth: 190,
      render: (status: WarrantyStatus) => renderStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      minWidth: 250,
      render: (_: any, record: ProbationWarrantyDTO) => {
        if (record.status === 'PASSED') {
          return <Tag color="green">Đã hoàn tất bảo hành</Tag>;
        }
        if (record.status === 'FAILED_WARRANTY_TRIGGERED') {
          return <Tag color="red">Đang tìm nhân sự thay thế</Tag>;
        }

        return (
          <Space size={8}>
            <Popconfirm
              title="Xác nhận Đạt Thử việc (PASS)?"
              description={`Xác nhận ứng viên ${record.candidateName} hoàn tất thử việc và kết thúc chu kỳ bảo hành 60 ngày?`}
              onConfirm={() => handleConfirmPass(record.id)}
              okText="Xác nhận PASS"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                size="small"
                loading={actionLoading}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                Xác nhận Đạt (PASS)
              </Button>
            </Popconfirm>

            <Button
              danger
              size="small"
              icon={<AlertOutlined />}
              onClick={() => openFailModal(record)}
            >
              Báo Nghỉ việc / Kích hoạt BH
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Theo dõi Bảo hành 60 ngày (Gói HEADHUNT_COD)
        </Title>
        <Text style={{ color: '#64748b' }}>
          Doanh nghiệp: <strong style={{ color: '#0f172a' }}>{user?.companyName || (user as any)?.company || user?.name || 'TechCorp Việt Nam'}</strong> • Giám sát ứng viên thử việc & cam kết bảo hành tìm nhân sự thay thế miễn phí
        </Text>
      </div>

      {/* ─── OVERVIEW METRICS ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đang trong thời hạn bảo hành</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
              {records.filter((r) => r.status === 'IN_PROBATION').length} Ứng viên
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Theo dõi sát sao tiến độ 60 ngày
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Đã thử việc thành công (PASS)</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
              {records.filter((r) => r.status === 'PASSED').length} Ứng viên
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Ký HĐLĐ chính thức & hoàn tất hợp đồng
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>Kích hoạt bảo hành thay thế</Text>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
              {records.filter((r) => r.status === 'FAILED_WARRANTY_TRIGGERED').length} Hồ sơ
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Headhunter tìm kiếm nhân sự thay thế miễn phí
            </div>
          </Card>
        </Col>
      </Row>

      {/* ─── POLICY NOTICE ────────────────────────────────────────────────────── */}
      <Alert
        message="Chính sách Bảo hành 60 ngày theo Đặc tả Mục 6 - Probation"
        description="Ứng viên tuyển qua gói Tuyển dụng trọn gói (COD) được bảo hành đổi người miễn phí 01 lần trong 60 ngày nếu ứng viên tự ý nghỉ việc hoặc không đáp ứng chuyên môn. Khi Doanh nghiệp bấm [Xác nhận Đạt], chu kỳ bảo hành chính thức hoàn thành."
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined style={{ color: '#2563eb' }} />}
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      {/* ─── FILTER CONTROL ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 240 }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'IN_PROBATION', label: 'Đang thử việc (Đếm ngược)' },
            { value: 'PASSED', label: 'Đã đạt thử việc (PASS)' },
            { value: 'FAILED_WARRANTY_TRIGGERED', label: 'Nghỉ việc sớm (Kích hoạt BH)' },
          ]}
        />
      </div>

      {/* ─── WARRANTY TABLE ───────────────────────────────────────────────────── */}
      <Card
        style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: 0 } }}
      >
        <Spin spinning={loading}>
          <Table<ProbationWarrantyDTO>
            columns={columns}
            dataSource={filteredRecords}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} nhân sự bảo hành` }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: 'Chưa có dữ liệu ứng viên trúng tuyển gói COD.' }}
          />
        </Spin>
      </Card>

      {/* ─── MODAL: BÁO NGHỈ VIỆC / KÍCH HOẠT BẢO HÀNH ──────────────────────── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <ExclamationCircleOutlined />
            <span>Kích hoạt Yêu cầu Bảo hành Đổi người Miễn phí</span>
          </div>
        }
        open={isFailModalOpen}
        onCancel={() => setIsFailModalOpen(false)}
        onOk={handleFailSubmit}
        confirmLoading={actionLoading}
        okText="Kích hoạt Bảo hành ngay"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        destroyOnClose
        width={560}
      >
        <div style={{ margin: '12px 0' }}>
          <Text type="secondary">
            Ghi nhận ứng viên nghỉ việc trong thời gian thử việc 60 ngày. Hệ thống sẽ lập tức gọi Service Layer gửi yêu cầu ưu tiên tới Internal HR / Affiliate phụ trách để kích hoạt điều khoản tìm nhân sự thay thế không tính thêm phí.
          </Text>
        </div>

        <Form form={failForm} layout="vertical">
          <Form.Item label="Ứng viên nghỉ việc" name="candidateName">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Vị trí tuyển dụng" name="jobTitle">
            <Input disabled />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Ngày nghỉ việc chính thức"
                name="resignationDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày nghỉ việc' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Lý do nghỉ việc"
                name="reason"
                rules={[{ required: true, message: 'Vui lòng chọn lý do' }]}
              >
                <Select
                  options={[
                    { value: 'CANDIDATE_RESIGNED', label: 'Ứng viên chủ động xin nghỉ' },
                    { value: 'NOT_QUALIFIED', label: 'Không đạt yêu cầu chuyên môn' },
                    { value: 'CULTURE_MISFIT', label: 'Không phù hợp văn hóa' },
                    { value: 'HEALTH_REASON', label: 'Lý do sức khỏe / cá nhân' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ghi chú chi tiết hoặc yêu cầu cho nhân sự thay thế" name="notes">
            <TextArea
              rows={3}
              placeholder="Mô tả cụ thể những điểm cần cải thiện hoặc lưu ý cho đợt sourcing ứng viên thay thế tiếp theo..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientWarrantyPage;
